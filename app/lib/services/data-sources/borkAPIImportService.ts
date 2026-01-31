/**
 * @registry-id: borkAPIImportService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Transform Bork API tickets to Layer 1 raw records and store in test-bork-sales-unified
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/api/cron/sync/api-snapshot/route.ts
 *   ✓ app/lib/services/aggregation/dailyOpsAggregationService.ts (reads test-bork-sales-unified)
 */

import type { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import ProductMaster from '@/models/ProductMaster';
import CategoryMaster from '@/models/CategoryMaster';
import { ensureDailyOpsCollections } from '@/lib/daily-ops/ensure-collections';
import { fetchBorkDataForDate } from '@/lib/bork/v2-api-client';
import type { RawSalesRecord } from '@/lib/types/raw-data.types';

const COLLECTION = 'test-bork-sales-unified';

type Ticket = Record<string, unknown>;
type Order = Record<string, unknown>;
type OrderLine = Record<string, unknown>;

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? 0 : n;
}

export interface BorkAPIImportResult {
  success: boolean;
  imported: number;
  failed: number;
  ticketsProcessed: number;
  errors: Array<{ ticketKey: string; error: string }>;
}

/**
 * Import Bork API tickets for a date and location into test-bork-sales-unified.
 * Flattens Orders/OrderLines to one raw record per line; resolves product/category by code or name.
 */
export async function importBorkAPITickets(
  locationId: string,
  dateKey: string,
  baseUrl: string,
  apiKey: string
): Promise<BorkAPIImportResult> {
  await ensureDailyOpsCollections();
  const db = await getDatabase();
  const dateStr = dateKey.replace(/-/g, '');
  const tickets = await fetchBorkDataForDate(baseUrl, apiKey, dateStr);
  const date = new Date(dateKey + 'T00:00:00.000Z');
  const locId = new mongoose.Types.ObjectId(locationId);

  const errors: Array<{ ticketKey: string; error: string }> = [];
  let imported = 0;

  for (const ticket of tickets as Ticket[]) {
    const ticketKey = String(ticket.Key ?? ticket.key ?? ticket.TicketNumber ?? ticket.TicketNumber ?? '');
    const orders = (ticket.Orders ?? ticket.orders ?? []) as Order[];
    for (const order of orders) {
      const lines = (order.OrderLines ?? order.orderLines ?? order.Lines ?? order.lines ?? []) as OrderLine[];
      for (const line of lines) {
        const productName = (line.ProductName ?? line.productName ?? line.Name ?? line.name ?? '') as string;
        const productKey = (line.ProductKey ?? line.productKey ?? line.Code ?? line.code ?? productName) as string;
        const quantity = num(line.Quantity ?? line.quantity ?? line.Qty ?? line.qty);
        const totalInc = num(line.TotalInc ?? line.totalInc ?? line.TotalIncVat ?? line.totalIncVat ?? line.Price ?? line.price);
        const totalEx = num(line.TotalEx ?? line.totalEx ?? line.TotalExVat ?? line.totalExVat);
        const cogs = num(line.Cost ?? line.cost ?? line.COGS ?? line.cogs);

        if (!productName && !productKey) continue;

        const product = await ProductMaster.findOne(
          productKey
            ? { $or: [{ code: productKey }, { name: productKey }], is_active: true }
            : { name: productName, is_active: true }
        ).lean();
        if (!product) {
          errors.push({ ticketKey, error: `Product not found: ${productKey || productName}` });
          continue;
        }

        const category = await CategoryMaster.findById(product.category_id).lean();
        if (!category) {
          errors.push({ ticketKey, error: `Category not found for product: ${product.name}` });
          continue;
        }

        const doc: Omit<RawSalesRecord, 'raw_csv' | 'raw_api'> & { raw_api?: Record<string, unknown> } = {
          date,
          product_id: product._id as ObjectId,
          category_id: category._id as ObjectId,
          location_id: locId,
          quantity,
          revenue: totalInc,
          cogs: cogs || product.cogs ?? 0,
          source: 'bork-api',
          transaction_id: ticketKey,
          external_id: ticketKey,
          imported_at: new Date(),
          raw_api: line as Record<string, unknown>,
        };

        try {
          await db.collection(COLLECTION).insertOne(doc);
          imported++;
        } catch (err) {
          errors.push({ ticketKey, error: err instanceof Error ? err.message : 'Insert failed' });
        }
      }
    }
  }

  return {
    success: errors.length === 0,
    imported,
    failed: errors.length,
    ticketsProcessed: tickets.length,
    errors,
  };
}
