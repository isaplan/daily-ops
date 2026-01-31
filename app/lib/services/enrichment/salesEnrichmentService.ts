/**
 * @registry-id: salesEnrichmentService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Add names to raw sales records (Layer 1 to Layer 2) using master data cache
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/services/aggregation/dailyOpsAggregationService.ts
 */

import type { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import { getProduct, getCategory, getLocation, getTeam } from '@/lib/services/cache/masterDataCacheService';
import type { RawSalesRecord } from '@/lib/types/raw-data.types';
import type { EnrichedSalesRecord } from '@/lib/types/enrichment.types';

const COLLECTION = 'test-bork-sales-unified';

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

  const filter: Record<string, unknown> = {
    date: { $gte: start, $lte: end },
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
