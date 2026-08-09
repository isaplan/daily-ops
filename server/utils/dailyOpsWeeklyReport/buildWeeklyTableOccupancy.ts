/**
 * @registry-id: dailyOpsWeeklyReportBuildTableOccupancy
 * @created: 2026-07-20T00:00:00.000Z
 * @last-modified: 2026-08-09T17:55:00.000Z
 * @description: Weekly/monthly table occupancy from period-cache day nodes
 * @last-fix: [2026-08-09] Period-cache byTable + venue catalog — no snapshot on GET
 * @adr-ref: PERIOD_CACHE_ADR L2, ADR-004, ADR-013
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsWeeklyReport/buildWeeklyDigest.ts
 * ✓ server/utils/dailyOpsMonthlyReport/buildMonthlyDigest.ts
 */

import type { Db } from 'mongodb'
import type { WeeklyTableOccupancySummary } from '~/types/daily-ops-weekly-report'
import { loadPeriodDayNodesForRange } from '../dailyOpsPeriodCache/loadPeriodDayNodesForRange'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import {
  DAILY_OPS_VENUE_TABLES_COLLECTION,
  ensureVenueTablesIndex,
  normalizeLocationId,
} from '../dailyOpsVenueTables/collection'
import { occupancyPct } from '../dailyOpsVenueTables/buildTableOccupancySummary'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

export async function buildWeeklyTableOccupancy (
  db: Db,
  startDate: string,
  endDate: string,
  locationId: string,
): Promise<WeeklyTableOccupancySummary> {
  await ensureVenueTablesIndex(db)
  const venues = VENUE_STRIP_LOCATIONS.filter((v) =>
    locationId !== 'all' ? v.locationId === locationId : true,
  )

  const [catalogRows, ...nodeLists] = await Promise.all([
    db
      .collection(DAILY_OPS_VENUE_TABLES_COLLECTION)
      .find(
        { locationId: { $in: venues.map((v) => v.locationId) } },
        { projection: { locationId: 1, tableNum: 1 } },
      )
      .toArray(),
    ...venues.map((v) =>
      loadPeriodDayNodesForRange(db, { startDate, endDate, locationId: v.locationId }),
    ),
  ])

  const totalByLoc = new Map<string, number>()
  for (const row of catalogRows) {
    const loc = normalizeLocationId(String(row.locationId))
    if (!loc || !String(row.tableNum ?? '').trim()) continue
    totalByLoc.set(loc, (totalByLoc.get(loc) ?? 0) + 1)
  }

  const venueRows = venues.map((venue, i) => {
    const nodes = nodeLists[i] ?? []
    const totalTables = totalByLoc.get(normalizeLocationId(venue.locationId)) ?? 0
    const dailyActive = nodes.map(
      (n) => new Set((n.revenue.byTable ?? []).map((t) => String(t.tableNum).trim()).filter(Boolean)).size,
    )
    const activeTables =
      dailyActive.length === 0
        ? 0
        : round2(dailyActive.reduce((s, n) => s + n, 0) / dailyActive.length)
    return {
      locationId: venue.locationId,
      locationName: venue.locationName,
      activeTables,
      totalTables,
      occupancyPct: occupancyPct(activeTables, totalTables),
    }
  })

  const activeTables = round2(venueRows.reduce((s, v) => s + v.activeTables, 0))
  const totalTables = venueRows.reduce((s, v) => s + v.totalTables, 0)

  return {
    activeTables,
    totalTables,
    occupancyPct: occupancyPct(activeTables, totalTables),
    aggregation: 'avg_daily',
    venues: venueRows,
  }
}
