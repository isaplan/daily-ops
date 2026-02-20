'use server';

/**
 * @registry-id: dailyOpsActions
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Server actions for Daily Ops dashboard - single query, no lookups
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/hooks/useDailyOpsDashboard.ts
 *   ✓ app/daily-ops/page.tsx
 *   ✓ app/daily-ops/DailyOpsDashboardClient.tsx
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import type { DailyOpsDashboard } from '@/lib/types/dashboard.types';

/** Collection name: daily_ops_dashboard_aggregated. DB: MONGODB_DB_NAME env or "daily-ops". */
const COLLECTION = 'daily_ops_dashboard_aggregated';

export interface GetDailyDashboardResult {
  data?: DailyOpsDashboard | null;
  error?: string;
}

function isObjectIdLike(val: unknown): val is ObjectId {
  return val != null && typeof val === 'object' && 'toString' in val && typeof (val as ObjectId).toString === 'function' && (val as { buffer?: unknown }).buffer !== undefined;
}

/** Serialize dashboard so Client Components receive plain objects (no ObjectId/toJSON). */
function serializeDashboard(doc: unknown): unknown {
  if (doc == null) return doc;
  if (isObjectIdLike(doc)) return (doc as ObjectId).toString();
  if (Array.isArray(doc)) return doc.map(serializeDashboard);
  if (typeof doc === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(doc)) out[k] = serializeDashboard(v);
    return out;
  }
  return doc;
}

export async function getDailyDashboard(
  date: string,
  locationId: string
): Promise<GetDailyDashboardResult> {
  try {
    const db = await getDatabase();
    const locId = new ObjectId(locationId);
    const doc = await db.collection(COLLECTION).findOne({
      date,
      location_id: locId,
    });
    const data = doc ? (serializeDashboard(doc) as DailyOpsDashboard) : null;
    return { data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message };
  }
}

export async function getRevenueBreakdown(
  date: string,
  locationId: string
): Promise<DailyOpsDashboard['revenue'] | null | { error: string }> {
  const result = await getDailyDashboard(date, locationId);
  if (result.error) return { error: result.error };
  return result.data?.revenue ?? null;
}

export async function getLaborMetrics(
  date: string,
  locationId: string
): Promise<DailyOpsDashboard['labor'] | null | { error: string }> {
  const result = await getDailyDashboard(date, locationId);
  if (result.error) return { error: result.error };
  return result.data?.labor ?? null;
}

export async function getProductAnalysis(
  date: string,
  locationId: string
): Promise<DailyOpsDashboard['products'] | null | { error: string }> {
  const result = await getDailyDashboard(date, locationId);
  if (result.error) return { error: result.error };
  return result.data?.products ?? null;
}

export async function getKPIs(
  date: string,
  locationId: string
): Promise<DailyOpsDashboard['kpis'] | null | { error: string }> {
  const result = await getDailyDashboard(date, locationId);
  if (result.error) return { error: result.error };
  return result.data?.kpis ?? null;
}

export async function getDailyHealth(
  date: string,
  locationId: string
): Promise<DailyOpsDashboard['sources'] | null | { error: string }> {
  const result = await getDailyDashboard(date, locationId);
  if (result.error) return { error: result.error };
  return result.data?.sources ?? null;
}

const LABOR_COLLECTION = 'test-eitje-hours';
const SALES_COLLECTION = 'test-bork-sales-unified';

export interface AvailableDatesResult {
  dashboard: string[];
  source: string[];
  error?: string;
}

/** Returns dates that have aggregated dashboard data, and dates that have raw source data, for the given location. */
export async function getAvailableDates(locationId: string): Promise<AvailableDatesResult> {
  try {
    const db = await getDatabase();
    const locId = new ObjectId(locationId);

    const toDateStr = (d: string | Date): string =>
      typeof d === 'string' ? d : (d as Date).toISOString().slice(0, 10);

    const [aggDates, laborDates, salesDates] = await Promise.all([
      db.collection(COLLECTION).distinct('date', { location_id: locId }) as Promise<string[]>,
      db.collection(LABOR_COLLECTION).distinct('date', { location_id: locId }).then((arr: (string | Date)[]) => (arr || []).map(toDateStr)),
      db.collection(SALES_COLLECTION).distinct('date', { location_id: locId }).then((arr: (string | Date)[]) => (arr || []).map(toDateStr)),
    ]);

    const dashboard = Array.isArray(aggDates) ? [...aggDates].sort().reverse() : [];
    const sourceSet = new Set<string>([...(laborDates || []), ...(salesDates || [])]);
    dashboard.forEach((d) => sourceSet.delete(d));
    const source = Array.from(sourceSet).sort().reverse();

    return { dashboard, source };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { dashboard: [], source: [], error: message };
  }
}
