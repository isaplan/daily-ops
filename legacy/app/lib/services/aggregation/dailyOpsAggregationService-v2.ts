/**
 * @registry-id: dailyOpsAggregationService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-02-02T00:00:00.000Z
 * @description: Build Layer 3 aggregated dashboard from enriched labor and sales. Now with separate, logged steps.
 * @last-fix: [2026-02-02] REFACTORED: Split into: fetch → enrich → validate → transform → write with detailed logging
 *
 * @exports-to:
 *   ✓ app/api/cron/daily-aggregation/route.ts
 *   ✓ app/actions/daily-ops.ts (reads daily_ops_dashboard_aggregated)
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import dbConnect from '@/lib/mongodb';
import Location from '@/models/Location';
import { loadAllMasterData, clearMasterDataCache } from '@/lib/services/cache/masterDataCacheService';
import { enrichLaborBatch, enrichLaborBatchFromEitjeRaw } from '@/lib/services/enrichment/laborEnrichmentService';
import { enrichSalesBatch, enrichSalesBatchFromBorkRaw } from '@/lib/services/enrichment/salesEnrichmentService';
import { validateEitjeTotals } from '@/lib/services/validation/eitjeValidationService';
import { validateBorkTotals } from '@/lib/services/validation/borkValidationService';
import { ensureDailyOpsCollections } from '@/lib/daily-ops/ensure-collections';
import type { DailyOpsDashboard, DashboardRevenue, DashboardLabor, DashboardProducts, DashboardKPIs, DashboardSources } from '@/lib/types/dashboard.types';
import type { EnrichedLaborRecord } from '@/lib/types/enrichment.types';
import type { EnrichedSalesRecord } from '@/lib/types/enrichment.types';

const AGGREGATED_COLLECTION = 'daily_ops_dashboard_aggregated';

export interface BuildAggregationResult {
  success: boolean;
  dashboardId?: string;
  error?: string;
  steps?: {
    fetch?: { eitje: number; bork: number };
    enrich?: { labor: number; sales: number };
    validate?: { eitjeMatch: boolean; borkMatch: boolean };
    transform?: { revenue: number; labor: { hours: number; cost: number }; products: number };
    write?: { success: boolean };
  };
}

export function buildRevenue(enrichedSales: EnrichedSalesRecord[]): DashboardRevenue {
  const total = enrichedSales.reduce((s, r) => s + r.revenue, 0);
  const byProductKey = new Map<string, { product_id: ObjectId; product_name: string; product_code?: string; category_id: ObjectId; category_name: string; quantity: number; revenue: number; cogs: number; margin: number }>();
  const byTeamKey = new Map<string, { team_id: ObjectId; team_name: string; location_id: ObjectId; location_name: string; revenue: number; staff_count?: number }>();

  for (const r of enrichedSales) {
    const pk = r.product_id.toString();
    if (!byProductKey.has(pk)) {
      byProductKey.set(pk, {
        product_id: r.product_id,
        product_name: r.product_name,
        product_code: r.product_code,
        category_id: r.category_id,
        category_name: r.category_name,
        quantity: 0,
        revenue: 0,
        cogs: 0,
        margin: 0,
      });
    }
    const p = byProductKey.get(pk)!;
    p.quantity += r.quantity;
    p.revenue += r.revenue;
    p.cogs += r.cogs;
    p.margin = p.revenue > 0 ? (p.revenue - p.cogs) / p.revenue : 0;

    if (r.team_id) {
      const tk = r.team_id.toString();
      if (!byTeamKey.has(tk)) {
        byTeamKey.set(tk, {
          team_id: r.team_id,
          team_name: r.team_name ?? '',
          location_id: r.location_id,
          location_name: r.location_name,
          revenue: 0,
        });
      }
      byTeamKey.get(tk)!.revenue += r.revenue;
    }
  }

  return {
    total,
    byProduct: Array.from(byProductKey.values()),
    byTeam: Array.from(byTeamKey.values()),
  };
}

export function buildLabor(
  enrichedLabor: EnrichedLaborRecord[],
  options?: { locationName?: string }
): DashboardLabor {
  const total_hours = enrichedLabor.reduce((s, r) => s + r.hours, 0);
  const total_cost = enrichedLabor.reduce((s, r) => s + r.cost, 0);
  const locationName = options?.locationName ?? undefined;
  const byTeamKey = new Map<
    string,
    {
      team_id: ObjectId;
      team_name: string;
      location_id: ObjectId;
      location_name: string;
      hours: number;
      cost: number;
      staff_count: number;
      members: Array<{ member_id: ObjectId; member_name: string; member_role: string; hours: number; cost: number; hourly_rate: number; productivity?: number; contract_type?: string }>;
    }
  >();

  for (const r of enrichedLabor) {
    const tk = r.team_id.toString();
    if (!byTeamKey.has(tk)) {
      byTeamKey.set(tk, {
        team_id: r.team_id,
        team_name: r.team_name,
        location_id: r.location_id,
        location_name: locationName ?? r.location_name,
        hours: 0,
        cost: 0,
        staff_count: 0,
        members: [],
      });
    }
    const t = byTeamKey.get(tk)!;
    t.hours += r.hours;
    t.cost += r.cost;
    const memberKey = r.member_id.toString();
    const existing = t.members.find((m) => m.member_id.toString() === memberKey);
    if (existing) {
      existing.hours += r.hours;
      existing.cost += r.cost;
    } else {
      t.members.push({
        member_id: r.member_id,
        member_name: r.member_name,
        member_role: r.member_role,
        hours: r.hours,
        cost: r.cost,
        hourly_rate: r.hourly_rate,
        contract_type: r.contract_type,
      });
    }
  }
  for (const t of byTeamKey.values()) {
    t.staff_count = t.members.length;
  }

  return {
    total_hours,
    total_cost,
    byTeam: Array.from(byTeamKey.values()),
  };
}

export function buildProducts(enrichedSales: EnrichedSalesRecord[]): DashboardProducts {
  const byProduct = new Map<string, { product_id: ObjectId; product_name: string; category_name: string; quantity: number; revenue: number; cogs: number; margin: number }>();
  for (const r of enrichedSales) {
    const pk = r.product_id.toString();
    if (!byProduct.has(pk)) {
      byProduct.set(pk, {
        product_id: r.product_id,
        product_name: r.product_name,
        category_name: r.category_name,
        quantity: 0,
        revenue: 0,
        cogs: 0,
        margin: 0,
      });
    }
    const p = byProduct.get(pk)!;
    p.quantity += r.quantity;
    p.revenue += r.revenue;
    p.cogs += r.cogs;
    p.margin = p.revenue > 0 ? (p.revenue - p.cogs) / p.revenue : 0;
  }
  const list = Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue);
  const topSellers = list.slice(0, 10).map((p) => ({
    product_id: p.product_id,
    product_name: p.product_name,
    quantity: p.quantity,
    revenue: p.revenue,
    percent_of_total: list.reduce((s, x) => s + x.revenue, 0) > 0 ? (p.revenue / list.reduce((s, x) => s + x.revenue, 0)) * 100 : 0,
  }));
  const topProfitable = list.slice(0, 10).map((p) => ({
    product_id: p.product_id,
    product_name: p.product_name,
    margin: p.margin,
    revenue: p.revenue,
    cogs: p.cogs,
  }));

  return {
    top_sellers: topSellers,
    top_profitable: topProfitable,
    by_product: list,
  };
}

export function buildKPIs(revenue: DashboardRevenue, labor: DashboardLabor): DashboardKPIs {
  const totalRevenue = revenue.total;
  const totalLaborCost = labor.total_cost;
  const laborCostPercentage = totalRevenue > 0 ? (totalLaborCost / totalRevenue) * 100 : 0;
  const revenuePerHour = labor.total_hours > 0 ? totalRevenue / labor.total_hours : 0;

  return {
    revenue: totalRevenue,
    labor_cost: totalLaborCost,
    labor_cost_percentage: laborCostPercentage,
    revenue_per_hour: revenuePerHour,
    staff_count: labor.byTeam.reduce((s, t) => s + t.staff_count, 0),
  };
}

/**
 * STEP 1: Fetch raw data from eitje and bork
 */
async function stepFetchRawData(
  dateObj: Date,
  locId: ObjectId
): Promise<{ eitje: number; bork: number }> {
  const db = await getDatabase();

  const eitjeCount = await db.collection('test-eitje-hours').countDocuments({
    date: dateObj,
    location_id: locId,
  });

  const borkCount = await db.collection('bork_raw_data').countDocuments({
    date: dateObj,
    location_id: locId,
  });

  console.log(`   📊 FETCH: Eitje ${eitjeCount} records, Bork ${borkCount} records`);

  return { eitje: eitjeCount, bork: borkCount };
}

/**
 * STEP 2: Enrich raw data (labor and sales)
 */
async function stepEnrichData(
  dateObj: Date,
  locId: ObjectId,
  defaultLocId?: ObjectId
): Promise<{ labor: EnrichedLaborRecord[]; sales: EnrichedSalesRecord[] }> {
  let laborResult = await enrichLaborBatch(dateObj, locId);
  if (laborResult.total === 0) {
    laborResult = await enrichLaborBatchFromEitjeRaw(dateObj, locId, { defaultLocationId: defaultLocId });
  }

  let salesResult = await enrichSalesBatch(dateObj, locId);
  if (salesResult.total === 0) {
    salesResult = await enrichSalesBatchFromBorkRaw(dateObj, locId);
  }

  console.log(`   ✨ ENRICH: ${laborResult.enriched.length} labor records, ${salesResult.enriched.length} sales records`);

  return {
    labor: laborResult.enriched,
    sales: salesResult.enriched,
  };
}

/**
 * STEP 3: Validate enriched data against CSV sources
 */
async function stepValidateData(
  dateStr: string,
  locationId: string
): Promise<{ eitjeMatch: boolean; borkMatch: boolean }> {
  const [eitjeValidation, borkValidation] = await Promise.all([
    validateEitjeTotals(dateStr, locationId),
    validateBorkTotals(dateStr, locationId),
  ]);

  console.log(`   ✓ VALIDATE: Eitje ${eitjeValidation.all_match ? '✓' : '✗'}, Bork ${borkValidation.revenue_match ? '✓' : '✗'}`);

  return {
    eitjeMatch: eitjeValidation.all_match,
    borkMatch: borkValidation.revenue_match,
  };
}

/**
 * STEP 4: Transform enriched data into dashboard structure
 */
async function stepTransformData(
  enrichedLabor: EnrichedLaborRecord[],
  enrichedSales: EnrichedSalesRecord[],
  locationName?: string
): Promise<{ revenue: DashboardRevenue; labor: DashboardLabor; products: DashboardProducts; kpis: DashboardKPIs }> {
  const revenue = buildRevenue(enrichedSales);
  const labor = buildLabor(enrichedLabor, { locationName });
  const products = buildProducts(enrichedSales);
  const kpis = buildKPIs(revenue, labor);

  console.log(`   📦 TRANSFORM: Revenue €${revenue.total.toFixed(2)}, Labor ${labor.total_hours.toFixed(1)}h @ €${labor.total_cost.toFixed(2)}, ${products.by_product.length} products`);

  return { revenue, labor, products, kpis };
}

/**
 * STEP 5: Write dashboard document
 */
async function stepWriteDashboard(
  dateStr: string,
  locId: ObjectId,
  locationName: string,
  location: any,
  revenue: DashboardRevenue,
  labor: DashboardLabor,
  products: DashboardProducts,
  kpis: DashboardKPIs,
  sources: DashboardSources
): Promise<{ success: boolean; id: string }> {
  const db = await getDatabase();
  const coll = db.collection(AGGREGATED_COLLECTION);
  const existing = await coll.findOne({ date: dateStr, location_id: locId });

  const now = new Date().toISOString();

  const dashboard: Omit<DailyOpsDashboard, '_id'> & { _id: ObjectId } = {
    _id: existing?._id ?? new ObjectId(),
    date: dateStr,
    location_id: locId,
    location: location
      ? { _id: new ObjectId(location._id.toString()), name: location.name, address: location.address, city: location.city, country: location.country }
      : undefined,
    revenue,
    labor,
    products,
    kpis,
    sources,
    metadata: { createdAt: existing?.metadata?.createdAt ?? now, updatedAt: now, version: 1 },
  };

  const result = await coll.replaceOne({ date: dateStr, location_id: locId }, dashboard, { upsert: true });
  console.log(`   💾 WRITE: Document ${existing ? 'updated' : 'created'}`);

  return { success: true, id: dashboard._id.toString() };
}

/**
 * Build and store one daily aggregated dashboard for a date and location.
 * Steps: Fetch → Enrich → Validate → Transform → Write
 */
export async function buildDailyAggregation(
  date: string,
  locationId: string,
  options?: { defaultLocationId?: string }
): Promise<BuildAggregationResult> {
  const steps: BuildAggregationResult['steps'] = {};

  try {
    console.log(`\n📅 Aggregating ${date} for location ${locationId}`);

    await dbConnect();
    await ensureDailyOpsCollections();
    await loadAllMasterData();

    const locId = new ObjectId(locationId);
    const dateObj = new Date(date + 'T12:00:00.000Z');
    const defaultLocId = options?.defaultLocationId ? new ObjectId(options.defaultLocationId) : undefined;

    // STEP 1: FETCH
    const fetchResult = await stepFetchRawData(dateObj, locId);
    steps.fetch = fetchResult;

    // STEP 2: ENRICH
    const enrichResult = await stepEnrichData(dateObj, locId, defaultLocId);
    steps.enrich = { labor: enrichResult.labor.length, sales: enrichResult.sales.length };

    // STEP 3: VALIDATE
    const validateResult = await stepValidateData(date, locationId);
    steps.validate = validateResult;

    // STEP 4: TRANSFORM
    const location = await Location.findById(locationId).lean();
    const locationName = location?.name ?? 'Unknown';
    const transformResult = await stepTransformData(enrichResult.labor, enrichResult.sales, locationName);
    steps.transform = {
      revenue: transformResult.revenue.total,
      labor: { hours: transformResult.labor.total_hours, cost: transformResult.labor.total_cost },
      products: transformResult.products.by_product.length,
    };

    const sources: DashboardSources = {
      eitje: {
        hours_records: enrichResult.labor.length,
        csv_verified: validateResult.eitjeMatch,
        api_verified: validateResult.eitjeMatch,
      },
      bork: {
        sales_records: enrichResult.sales.length,
        total_revenue: transformResult.revenue.total,
        csv_verified: validateResult.borkMatch,
        api_verified: validateResult.borkMatch,
      },
      validation: {
        eitje_vs_csv: { matches: validateResult.eitjeMatch, variance: 0 },
        bork_vs_csv: { matches: validateResult.borkMatch, variance: 0 },
      },
    };

    // STEP 5: WRITE
    const writeResult = await stepWriteDashboard(
      date,
      locId,
      locationName,
      location,
      transformResult.revenue,
      transformResult.labor,
      transformResult.products,
      transformResult.kpis,
      sources
    );
    steps.write = writeResult;

    clearMasterDataCache();

    console.log(`✅ Complete\n`);

    return { success: true, dashboardId: writeResult.id, steps };
  } catch (err) {
    clearMasterDataCache();
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.log(`❌ Error: ${message}\n`);
    return { success: false, error: message, steps };
  }
}
