/**
 * @registry-id: salesSyncService
 * @created: 2026-02-22T00:00:00.000Z
 * @last-modified: 2026-02-22T00:00:00.000Z
 *
 * Sales Sync Service (Bork API → MongoDB)
 * Syncs sales data from Bork API to bork_raw_data with batched bulkWrite.
 *
 * Batching:
 * - API: fetchBorkDataForDateRange uses day-by-day requests with BORK_DAY_REQUEST_DELAY_MS and batch chunks.
 * - DB: operations chunked into BULK_WRITE_BATCH_SIZE; each chunk written with bulkWrite (ordered: false).
 *
 * @imports-from:
 *   - app/lib/mongodb/v2-connection.ts => getDatabase
 *   - app/lib/bork/v2-api-client.ts => fetchBorkDataForDateRange
 *   - app/lib/bork/v2-data-optimizer.ts => optimizeBorkTickets
 *
 * @exports-to:
 *   ✓ app/api/bork/v2/sync/route.ts => syncSalesData
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import { fetchBorkDataForDateRange } from '@/lib/bork/v2-api-client';
import { optimizeBorkTickets } from '@/lib/bork/v2-data-optimizer';
import { ensureBorkCollections } from '@/lib/bork/v2-ensure-collections';

const BORK_RAW_COLLECTION = 'bork_raw_data';

/** Max operations per bulkWrite to avoid driver limits and ensure writes complete. */
const BULK_WRITE_BATCH_SIZE = 500;

export type SalesSyncResult = {
  success: boolean;
  recordsSaved: number;
  ticketsProcessed: number;
  ticketsSkipped: number;
  error?: string;
};

/**
 * Get YYYY-MM-DD from a ticket. Uses ActualDate (YYYYMMDD) or Date when valid; otherwise request date (no skip).
 */
function getDateKeyFromTicket(
  ticket: Record<string, unknown>,
  requestDateKey: string
): string {
  const raw = ticket.ActualDate ?? ticket.Date ?? ticket.actualDate ?? ticket.date;
  if (raw == null) return requestDateKey;
  const str = String(raw);
  if (str.length === 8 && /^\d{8}$/.test(str)) {
    const year = parseInt(str.slice(0, 4), 10);
    const month = parseInt(str.slice(4, 6), 10) - 1;
    const day = parseInt(str.slice(6, 8), 10);
    if (year >= 2000 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    }
  }
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  return requestDateKey;
}

/**
 * Group tickets by date with fallback: use ActualDate/Date when valid, else request date (no data skipped).
 */
function groupTicketsByDateWithFallback(
  dayResults: { dateKey: string; tickets: unknown[] }[]
): Map<string, unknown[]> {
  const byDate = new Map<string, unknown[]>();
  for (const { dateKey, tickets } of dayResults) {
    for (const ticket of tickets) {
      const t = ticket as Record<string, unknown>;
      const key = getDateKeyFromTicket(t, dateKey);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(ticket);
    }
  }
  return byDate;
}

/**
 * Sync sales data from Bork API into bork_raw_data.
 * No data skipped: tickets without valid ActualDate use the request date (day we asked the API for).
 * Uses bulkWrite (batched) for all date records.
 *
 * @param locationId - Location ObjectId string or external ID
 * @param startDate - YYYY-MM-DD
 * @param endDate - YYYY-MM-DD
 * @param baseUrl - Bork API base URL
 * @param apiKey - Bork API key
 * @param fullRewrite - If true, delete existing records in range then insert
 */
export async function syncSalesData(
  locationId: string,
  startDate: string,
  endDate: string,
  baseUrl: string,
  apiKey: string,
  fullRewrite: boolean = false
): Promise<SalesSyncResult> {
  try {
    await ensureBorkCollections();
    const db = await getDatabase();
    let locationObjectId: ObjectId | null = null;

    try {
      locationObjectId = new ObjectId(locationId);
    } catch {
      const loc = await db.collection('locations').findOne({
        'systemMappings.externalId': locationId,
        'systemMappings.system': 'bork',
      });
      if (loc) locationObjectId = loc._id;
    }

    if (!locationObjectId) {
      return {
        success: false,
        recordsSaved: 0,
        ticketsProcessed: 0,
        ticketsSkipped: 0,
        error: `Location not found: ${locationId}`,
      };
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (fullRewrite) {
      await db.collection(BORK_RAW_COLLECTION).deleteMany({
        locationId: locationObjectId,
        date: { $gte: start, $lte: end },
      });
    }

    const dayResults = await fetchBorkDataForDateRange(baseUrl, apiKey, startDate, endDate);
    if (!Array.isArray(dayResults) || dayResults.length === 0) {
      console.log(`[Bork Sales Sync] ${locationId} ${startDate}..${endDate}: no data (0 saved, 0 tickets)`);
      return {
        success: true,
        recordsSaved: 0,
        ticketsProcessed: 0,
        ticketsSkipped: 0,
      };
    }

    const ticketsByDate = groupTicketsByDateWithFallback(dayResults);
    const ticketsProcessed = dayResults.reduce((sum, d) => sum + d.tickets.length, 0);

    const operations: {
      updateOne: {
        filter: Record<string, unknown>;
        update: { $set: Record<string, unknown>; $setOnInsert?: Record<string, unknown> };
        upsert: boolean;
      };
    }[] = [];

    for (const [dateKey, tickets] of ticketsByDate.entries()) {
      const date = new Date(dateKey + 'T00:00:00.000Z');
      if (Number.isNaN(date.getTime())) continue;
      const optimized = optimizeBorkTickets(tickets as Record<string, unknown>[]);
      const now = new Date();

      operations.push({
        updateOne: {
          filter: { locationId: locationObjectId, date },
          update: {
            $set: { rawApiResponse: optimized, extracted: {}, updatedAt: now },
            $setOnInsert: { locationId: locationObjectId, date, createdAt: now },
          },
          upsert: true,
        },
      });
    }

    if (operations.length === 0) {
      return {
        success: true,
        recordsSaved: 0,
        ticketsProcessed,
        ticketsSkipped: 0,
      };
    }

    const collection = db.collection(BORK_RAW_COLLECTION);
    let recordsSaved = 0;
    for (let i = 0; i < operations.length; i += BULK_WRITE_BATCH_SIZE) {
      const batch = operations.slice(i, i + BULK_WRITE_BATCH_SIZE);
      const result = await collection.bulkWrite(batch, { ordered: false });
      recordsSaved += result.upsertedCount + result.modifiedCount;
    }

    console.log(`[Bork Sales Sync] ${locationId} ${startDate}..${endDate}: saved ${recordsSaved}, tickets ${ticketsProcessed}`);
    return {
      success: true,
      recordsSaved,
      ticketsProcessed,
      ticketsSkipped: 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      recordsSaved: 0,
      ticketsProcessed: 0,
      ticketsSkipped: 0,
      error: message,
    };
  }
}
