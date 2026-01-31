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

const COLLECTION = 'v2_daily_ops_dashboard_aggregated';

export interface GetDailyDashboardResult {
  data?: DailyOpsDashboard | null;
  error?: string;
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
    return { data: doc as DailyOpsDashboard | null };
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
