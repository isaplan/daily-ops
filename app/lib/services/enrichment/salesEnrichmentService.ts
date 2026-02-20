/**
 * @registry-id: salesEnrichmentService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-02-02T00:00:00.000Z
 * @description: Add names to raw sales records (Layer 1 to Layer 2) using master data cache
 * @last-fix: [2026-02-02] Flexible date: match Date range or YYYY-MM-DD; Bork raw fallback by date string
 *
 * @exports-to:
 *   ✓ app/lib/services/aggregation/dailyOpsAggregationService.ts
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import dbConnect from '@/lib/mongodb';
import { getProduct, getCategory, getLocation, getTeam } from '@/lib/services/cache/masterDataCacheService';
import ProductMaster from '@/models/ProductMaster';
import CategoryMaster from '@/models/CategoryMaster';
import type { RawSalesRecord } from '@/lib/types/raw-data.types';
import type { EnrichedSalesRecord } from '@/lib/types/enrichment.types';

const COLLECTION = 'test-bork-sales-unified';
const BORK_RAW_COLLECTION = 'bork_raw_data';

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? 0 : n;
}

export interface EnrichSalesBatchResult {
  enriched: EnrichedSalesRecord[];
  skipped: number;
  total: number;
}

/**
 * Enrich a single raw sales record with product, category, location, team names. O(1) after cache load.
 */
export function enrichSalesRecord(raw: RawSalesRecord & { _id?: ObjectId }): EnrichedSalesRecord | null {
  const product = getProduct(raw.product_id);
  const category = getCategory(raw.category_id);
  const location = getLocation(raw.location_id);
  const team = raw.team_id ? getTeam(raw.team_id) : null;
  if (!product || !category || !location) return null;

  const margin = raw.revenue > 0 ? (raw.revenue - raw.cogs) / raw.revenue : 0;

  return {
    date: raw.date,
    product_id: raw.product_id,
    product_name: product.name,
    product_code: product.code,
    category_id: raw.category_id,
    category_name: category.name,
    location_id: raw.location_id,
    location_name: location.name,
    team_id: raw.team_id,
    team_name: team?.name,
    quantity: raw.quantity,
    revenue: raw.revenue,
    cogs: raw.cogs,
    margin,
    source: raw.source,
    transaction_id: raw.transaction_id,
    external_id: raw.external_id,
    support_id: raw.support_id,
  };
}

/**
 * Load raw sales records for a date and location, enrich with names, return enriched list.
 * Caller must call loadAllMasterData() once before calling this.
 */
export async function enrichSalesBatch(
  date: Date,
  locationId: ObjectId,
  options?: { skip?: number; limit?: number }
): Promise<EnrichSalesBatchResult> {
  const db = await getDatabase();

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const dateStr = date.toISOString().slice(0, 10);

  const filter: Record<string, unknown> = {
    $or: [
      { date: { $gte: start, $lte: end } },
      { date: dateStr },
    ],
    location_id: locationId,
  };
  const cursor = db.collection(COLLECTION).find(filter);
  if (options?.skip != null) cursor.skip(options.skip);
  if (options?.limit != null) cursor.limit(options.limit);
  const rawList = await cursor.toArray();

  const enriched: EnrichedSalesRecord[] = [];
  let skipped = 0;
  for (const raw of rawList as (RawSalesRecord & { _id?: ObjectId })[]) {
    const e = enrichSalesRecord(raw);
    if (e) enriched.push(e);
    else skipped++;
  }

  return { enriched, skipped, total: rawList.length };
}

/**
 * Load sales from bork_raw_data (Bork sync target) when test-bork-sales-unified has no data.
 * Flattens tickets/Orders/Lines, resolves product/category by code or name. Call when enrichSalesBatch returns 0.
 */
export async function enrichSalesBatchFromBorkRaw(
  date: Date,
  locationId: ObjectId
): Promise<EnrichSalesBatchResult> {
  await dbConnect();
  const db = await getDatabase();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const dateStr = date.toISOString().slice(0, 10);

  let doc = await db.collection(BORK_RAW_COLLECTION).findOne({
    locationId,
    date: { $gte: start, $lte: end },
  });
  if (!doc?.rawApiResponse || !Array.isArray(doc.rawApiResponse)) {
    doc = await db.collection(BORK_RAW_COLLECTION).findOne({
      locationId,
      date: dateStr,
    });
  }
  if (!doc?.rawApiResponse || !Array.isArray(doc.rawApiResponse)) {
    return { enriched: [], skipped: 0, total: 0 };
  }

  const location = getLocation(locationId);
  const locationName = location?.name ?? 'Unknown';
  const tickets = doc.rawApiResponse as Record<string, unknown>[];
  const enriched: EnrichedSalesRecord[] = [];
  let total = 0;
  let skipped = 0;
  let unmatchedRevenue = 0;
  let unmatchedCogs = 0;
  let unmatchedQty = 0;

  for (const ticket of tickets) {
    const orders = (ticket.Orders ?? ticket.orders ?? []) as Record<string, unknown>[];
    for (const order of orders) {
      const lines = (order.Lines ?? order.OrderLines ?? order.lines ?? order.orderLines ?? []) as Record<string, unknown>[];
      for (const line of lines) {
        total++;
        const productName = String(line.ProductName ?? line.productName ?? line.Name ?? line.name ?? '').trim();
        const productKey = String(line.ProductKey ?? line.productKey ?? line.Code ?? line.code ?? productName).trim();
        const quantity = num(line.Qty ?? line.Quantity ?? line.qty ?? line.quantity);
        const revenue = num(line.TotalInc ?? line.totalInc ?? line.TotalIncVat ?? line.totalIncVat ?? line.Price ?? line.price);
        const cogs = num(line.Cost ?? line.cost ?? line.COGS ?? line.cogs);

        if (!productName && !productKey) {
          skipped++;
          continue;
        }

        const product = await ProductMaster.findOne(
          productKey
            ? { $or: [{ code: productKey }, { name: productKey }], is_active: true }
            : { name: productName, is_active: true }
        ).lean();
        if (!product) {
          unmatchedRevenue += revenue;
          unmatchedCogs += cogs;
          unmatchedQty += quantity;
          skipped++;
          continue;
        }
        const category = await CategoryMaster.findById(product.category_id).lean();
        if (!category) {
          unmatchedRevenue += revenue;
          unmatchedCogs += cogs;
          unmatchedQty += quantity;
          skipped++;
          continue;
        }

        const margin = revenue > 0 ? (revenue - cogs) / revenue : 0;
        const ticketKey = String(ticket.Key ?? ticket.key ?? ticket.TicketNumber ?? '');

        enriched.push({
          date,
          product_id: new ObjectId(product._id.toString()),
          product_name: product.name,
          product_code: product.code ?? '',
          category_id: new ObjectId(category._id.toString()),
          category_name: category.name,
          location_id: locationId,
          location_name: locationName,
          quantity,
          revenue,
          cogs,
          margin,
          source: 'bork-api',
          transaction_id: ticketKey,
          external_id: ticketKey,
        });
      }
    }
  }

  // When no product master matches (e.g. empty ProductMaster), still show revenue as one "Sales" record
  if (unmatchedRevenue > 0) {
    let fallbackProduct = await ProductMaster.findOne({ is_active: true }).lean();
    let fallbackCategory = fallbackProduct
      ? await CategoryMaster.findById(fallbackProduct.category_id).lean()
      : await CategoryMaster.findOne({}).lean();
    if (!fallbackCategory) {
      const created = await CategoryMaster.findOneAndUpdate(
        { name: 'Sales' },
        { $setOnInsert: { name: 'Sales', is_active: true } },
        { upsert: true, new: true }
      ).lean();
      fallbackCategory = created;
    }
    if (!fallbackProduct && fallbackCategory) {
      const created = await ProductMaster.findOneAndUpdate(
        { code: 'SALES-BORK' },
        {
          $setOnInsert: {
            name: 'Sales (Bork)',
            code: 'SALES-BORK',
            category_id: fallbackCategory!._id,
            cogs: 0,
            margin: 0,
            is_active: true,
          },
        },
        { upsert: true, new: true }
      ).lean();
      fallbackProduct = created;
    }
    if (fallbackProduct && fallbackCategory) {
      const margin = unmatchedRevenue > 0 ? (unmatchedRevenue - unmatchedCogs) / unmatchedRevenue : 0;
      enriched.push({
        date,
        product_id: new ObjectId(fallbackProduct._id.toString()),
        product_name: fallbackProduct.name,
        product_code: fallbackProduct.code ?? '',
        category_id: new ObjectId(fallbackCategory._id.toString()),
        category_name: fallbackCategory.name,
        location_id: locationId,
        location_name: locationName,
        quantity: unmatchedQty,
        revenue: unmatchedRevenue,
        cogs: unmatchedCogs,
        margin,
        source: 'bork-api',
      });
    }
  }

  return { enriched, skipped, total };
}
