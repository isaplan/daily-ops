/**
 * @registry-id: dailyOpsRevenueDailySeries
 * @created: 2026-05-22T12:00:00.000Z
 * @last-modified: 2026-08-09T15:50:00.000Z
 * @description: Daily revenue series from period-cache day nodes (GET)
 * @last-fix: [2026-08-09] ZERO GET — period-cache only; miss → empty map (no snapshot)
 * @adr-ref: ADR-004, ADR-006, PERIOD_CACHE_ADR L2
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsRevenue/fetchRevenueTimeseries.ts
 * ✓ server/utils/dailyOpsRevenue/computeBenchmark60d.ts
 * ✓ server/utils/dailyOpsRevenue/computeRollingMedians.ts
 * ✓ server/utils/dailyOpsStaff/fetchStaffTimeseries.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsRevenueTimeseriesPoint } from '~/types/daily-ops-revenue'
import { eachBusinessDate } from './dateRange'
import { loadPeriodDayNodesForRange } from '../dailyOpsPeriodCache/loadPeriodDayNodesForRange'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

/** Period-cache only. Name kept for existing callers. */
export async function fetchRevenueDailyFromSnapshots (
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<Map<string, DailyOpsRevenueTimeseriesPoint>> {
  const nodes = await loadPeriodDayNodesForRange(db, {
    startDate,
    endDate,
    locationId: locationId ?? 'all',
  })
  const map = new Map<string, DailyOpsRevenueTimeseriesPoint>()
  for (const n of nodes) {
    const qty = (n.revenue.byCategory ?? []).reduce((s, c) => s + c.qty, 0)
    map.set(n.periodKey, {
      date: n.periodKey,
      revenue: round2(n.revenue.exVat),
      itemsCount: qty,
    })
  }
  return map
}

export async function buildRevenueDailySeries (
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<DailyOpsRevenueTimeseriesPoint[]> {
  const byDate = await fetchRevenueDailyFromSnapshots(db, startDate, endDate, locationId)

  return [...eachBusinessDate(startDate, endDate)].map(
    (date) =>
      byDate.get(date) ?? {
        date,
        revenue: 0,
        itemsCount: 0,
      },
  )
}

export async function fetchRevenueDailyMap (
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<Map<string, DailyOpsRevenueTimeseriesPoint>> {
  return fetchRevenueDailyFromSnapshots(db, startDate, endDate, locationId)
}
