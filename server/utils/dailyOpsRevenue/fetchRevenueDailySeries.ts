/**
 * @registry-id: dailyOpsRevenueDailySeries
 * @created: 2026-05-22T12:00:00.000Z
 * @last-modified: 2026-08-09T00:45:00.000Z
 * @description: Daily revenue series from period-cache day nodes (GET)
 * @last-fix: [2026-08-09] Period-cache first; logged snapshot fallback on miss
 * @adr-ref: ADR-004, ADR-006, PERIOD_CACHE_ADR L2
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsRevenue/fetchRevenueTimeseries.ts
 * ✓ server/utils/dailyOpsRevenue/computeBenchmark60d.ts
 * ✓ server/utils/dailyOpsRevenue/computeRollingMedians.ts
 * ✓ server/utils/dailyOpsStaff/fetchStaffTimeseries.ts
 */

import type { Db } from 'mongodb'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import type { DailyOpsRevenueTimeseriesPoint } from '~/types/daily-ops-revenue'
import { eachBusinessDate } from './dateRange'
import { loadPeriodDayNodesForRange } from '../dailyOpsPeriodCache/loadPeriodDayNodesForRange'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

type SnapshotRevenueRow = {
  businessDate: string
  totals?: { ex_vat?: number; quantity?: number }
}

async function fromPeriodCache (
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<Map<string, DailyOpsRevenueTimeseriesPoint> | null> {
  const nodes = await loadPeriodDayNodesForRange(db, {
    startDate,
    endDate,
    locationId: locationId ?? 'all',
  })
  if (nodes.length === 0) return null
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

async function fromSnapshotFallback (
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<Map<string, DailyOpsRevenueTimeseriesPoint>> {
  console.warn(
    `[period-cache] revenue daily series miss ${startDate}..${endDate} loc=${locationId ?? 'all'} — snapshot fallback`,
  )
  const filter: Record<string, unknown> = {
    businessDate: { $gte: startDate, $lte: endDate },
  }
  if (locationId) filter.locationId = locationId

  const rows = (await db
    .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection)
    .find(filter, { projection: { businessDate: 1, totals: 1 } })
    .toArray()) as unknown as SnapshotRevenueRow[]

  const map = new Map<string, DailyOpsRevenueTimeseriesPoint>()
  for (const row of rows) {
    const t = row.totals
    const ex = Number(t?.ex_vat ?? 0)
    const qty = Number(t?.quantity ?? 0)
    const cur = map.get(row.businessDate)
    if (cur) {
      cur.revenue = round2(cur.revenue + ex)
      cur.itemsCount += qty
    } else {
      map.set(row.businessDate, {
        date: row.businessDate,
        revenue: round2(ex),
        itemsCount: qty,
      })
    }
  }
  return map
}

/** Period-cache first; logged snapshot fallback. Name kept for existing callers. */
export async function fetchRevenueDailyFromSnapshots (
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<Map<string, DailyOpsRevenueTimeseriesPoint>> {
  const fromCache = await fromPeriodCache(db, startDate, endDate, locationId)
  if (fromCache) return fromCache
  return fromSnapshotFallback(db, startDate, endDate, locationId)
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
