/**
 * @registry-id: dailyOpsOccupancyRangeBatch
 * @created: 2026-07-20T00:05:00.000Z
 * @last-modified: 2026-07-20T00:05:00.000Z
 * @description: Batch avg-daily occupancy % for many week/month ranges (one snapshot scan)
 * @last-fix: [2026-07-20] Avoid N× occupancy rebuilds in digest comparisons
 * @adr-ref: ADR-004, ADR-013
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsWeeklyReport/buildWeeklyDigest.ts
 * ✓ server/utils/dailyOpsMonthlyReport/buildMonthlyDigest.ts
 */

import type { Db } from 'mongodb'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import {
  DAILY_OPS_VENUE_TABLES_COLLECTION,
  ensureVenueTablesIndex,
  normalizeLocationId,
} from '../dailyOpsVenueTables/collection'
import { occupancyPct } from '../dailyOpsVenueTables/buildTableOccupancySummary'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null
  return round1(nums.reduce((s, n) => s + n, 0) / nums.length)
}

export type OccupancyDateRange = {
  key: string
  startDate: string
  endDate: string
}

/** One Mongo pass → occupancyPct per range key (avg of daily venue-combined %). */
export async function occupancyPctByRangeKeys(
  db: Db,
  ranges: OccupancyDateRange[],
  locationId: string,
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  if (ranges.length === 0) return out

  await ensureVenueTablesIndex(db)
  const venues = VENUE_STRIP_LOCATIONS.filter((v) =>
    locationId !== 'all' ? v.locationId === locationId : true,
  )
  const locationIds = venues.map((v) => v.locationId)
  const minStart = ranges.reduce((m, r) => (r.startDate < m ? r.startDate : m), ranges[0]!.startDate)
  const maxEnd = ranges.reduce((m, r) => (r.endDate > m ? r.endDate : m), ranges[0]!.endDate)

  const [catalogRows, snapshotDocs] = await Promise.all([
    db
      .collection(DAILY_OPS_VENUE_TABLES_COLLECTION)
      .find(
        { locationId: { $in: locationIds } },
        { projection: { locationId: 1, tableNum: 1 } },
      )
      .toArray(),
    db
      .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueTablesSection)
      .find(
        {
          locationId: { $in: locationIds },
          businessDate: { $gte: minStart, $lte: maxEnd },
        },
        { projection: { locationId: 1, businessDate: 1, tables: 1 } },
      )
      .toArray(),
  ])

  const totalByLocation = new Map<string, number>()
  for (const row of catalogRows) {
    const loc = normalizeLocationId(row.locationId)
    const tableNum = String(row.tableNum ?? '').trim()
    if (!loc || !tableNum) continue
    totalByLocation.set(loc, (totalByLocation.get(loc) ?? 0) + 1)
  }

  /** loc → date → active set size */
  const activeCount = new Map<string, Map<string, number>>()
  for (const doc of snapshotDocs) {
    const loc = normalizeLocationId(doc.locationId)
    const date = String(doc.businessDate ?? '').trim()
    if (!loc || !date) continue
    const set = new Set<string>()
    const tables = Array.isArray(doc.tables) ? doc.tables : []
    for (const t of tables) {
      const tableNum = String((t as { tableNum?: unknown })?.tableNum ?? '').trim()
      if (tableNum) set.add(tableNum)
    }
    const byDate = activeCount.get(loc) ?? new Map<string, number>()
    byDate.set(date, set.size)
    activeCount.set(loc, byDate)
  }

  for (const range of ranges) {
    const dates = enumerateUtcDatesInclusive(range.startDate, range.endDate)
    const dayPcts: number[] = []
    for (const date of dates) {
      let activeSum = 0
      let totalSum = 0
      for (const v of venues) {
        const total = totalByLocation.get(v.locationId) ?? 0
        const active = activeCount.get(v.locationId)?.get(date) ?? 0
        activeSum += active
        totalSum += total
      }
      const pct = occupancyPct(activeSum, totalSum)
      if (pct != null) dayPcts.push(pct)
    }
    out.set(range.key, mean(dayPcts))
  }

  return out
}
