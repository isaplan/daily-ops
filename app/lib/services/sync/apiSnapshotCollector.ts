/**
 * @registry-id: apiSnapshotCollector
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Collect API snapshots hourly (00-23) for reconciliation
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/api/cron/sync/api-snapshot/route.ts
 */

import { getDatabase } from '@/lib/mongodb/v2-connection';
import { ensureDailyOpsCollections } from '@/lib/daily-ops/ensure-collections';
import { fetchBorkDataForDate } from '@/lib/bork/v2-api-client';
import { getAllBorkCredentials } from '@/lib/bork/v2-credentials';

export interface APISnapshotPayload {
  timestamp: Date;
  hour: number;
  type: 'api_snapshot';
  eitjeHours?: { total_records: number; data: unknown[] };
  borkSales?: { total_records: number; data: unknown[] };
  snapshot_metadata: {
    intended_hour: number;
    actual_fetch_time: Date;
    api_latency_ms?: number;
    source: 'api';
  };
}

export interface CollectAPISnapshotResult {
  success: boolean;
  snapshotId?: string;
  hour: number;
  borkTicketsFetched?: number;
  error?: string;
}

/**
 * Collect and store API snapshot for the given hour. Call hourly.
 * Fetches Bork sales for today when credentials exist; Eitje can be added later.
 */
export async function collectAPISnapshot(hour: number): Promise<CollectAPISnapshotResult> {
  try {
    await ensureDailyOpsCollections();
    const db = await getDatabase();
    const now = new Date();
    const today = now.toISOString().slice(0, 10).replace(/-/g, '');

    let borkSales: { total_records: number; data: unknown[] } = { total_records: 0, data: [] };
    const creds = await getAllBorkCredentials();
    for (const c of creds) {
      try {
        const tickets = await fetchBorkDataForDate(c.baseUrl, c.apiKey, today);
        borkSales.data.push(...tickets);
      } catch {
        // Skip failed location
      }
    }
    borkSales.total_records = borkSales.data.length;

    const doc: APISnapshotPayload = {
      timestamp: now,
      hour,
      type: 'api_snapshot',
      borkSales,
      snapshot_metadata: {
        intended_hour: hour,
        actual_fetch_time: now,
        source: 'api',
      },
    };

    const result = await db.collection('snapshots_api').insertOne(doc);
    return {
      success: true,
      snapshotId: result.insertedId.toString(),
      hour,
      borkTicketsFetched: borkSales.total_records,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, hour, error: message };
  }
}
