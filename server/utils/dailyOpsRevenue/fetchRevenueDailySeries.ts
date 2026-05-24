/**
 * @registry-id: dailyOpsRevenueDailySeries
 * @created: 2026-05-22T12:00:00.000Z
 * @last-modified: 2026-05-23T00:00:00.000Z
 * @description: One-query daily revenue series from snapshot sections (ADR-004 hot read)
 * @last-fix: [2026-05-24] Snapshot-only on GET (ADR-004); no Bork gap fill on read path
 * @adr-ref: ADR-004, ADR-006
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsRevenue/fetchRevenueTimeseries.ts
 * ✓ server/utils/dailyOpsRevenue/computeBenchmark60d.ts
 * ✓ server/utils/dailyOpsRevenue/computeRollingMedians.ts
 */

import type { Db } from 'mongodb'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import type { DailyOpsRevenueTimeseriesPoint } from '~/types/daily-ops-revenue'
import { eachBusinessDate } from './dateRange'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

type SnapshotRevenueRow = {
  businessDate: string
  totals?: { ex_vat?: number; quantity?: number }
}

/** Single find on daily_ops_snapshot_section_revenue for the whole range. */
export async function fetchRevenueDailyFromSnapshots(
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<Map<string, DailyOpsRevenueTimeseriesPoint>> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: startDate, $lte: endDate },
  }
  if (locationId) filter.locationId = locationId

  const rows = (await db
    .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection)
    .find(filter, { projection: { businessDate: 1, totals: 1 } })
    .toArray()) as SnapshotRevenueRow[]

  const map = new Map<string, DailyOpsRevenueTimeseriesPoint>()
  for (const row of rows) {
    const t = row.totals
    map.set(row.businessDate, {
      date: row.businessDate,
      revenue: round2(Number(t?.ex_vat ?? 0)),
      itemsCount: Number(t?.quantity ?? 0),
    })
  }
  return map
}

/** Daily points for every calendar day in range (snapshot sections only). */
export async function buildRevenueDailySeries(
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

/** Load snapshot + optional Bork daily map for a range (shared by benchmark / rolling). */
export async function fetchRevenueDailyMap(
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<Map<string, DailyOpsRevenueTimeseriesPoint>> {
  return fetchRevenueDailyFromSnapshots(db, startDate, endDate, locationId)
}
