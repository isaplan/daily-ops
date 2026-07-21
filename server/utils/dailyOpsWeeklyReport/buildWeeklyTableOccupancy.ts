/**
 * @registry-id: dailyOpsWeeklyReportBuildTableOccupancy
 * @created: 2026-07-20T00:00:00.000Z
 * @last-modified: 2026-07-20T00:00:00.000Z
 * @description: Weekly/monthly table occupancy block for digests (avg daily)
 * @last-fix: [2026-07-20] Initial weekly table occupancy digest builder
 * @adr-ref: ADR-004, ADR-013
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsWeeklyReport/buildWeeklyDigest.ts
 * ✓ server/utils/dailyOpsMonthlyReport/buildMonthlyDigest.ts
 */

import type { Db } from 'mongodb'
import type { WeeklyTableOccupancySummary } from '~/types/daily-ops-weekly-report'
import { buildTableOccupancySummary } from '../dailyOpsVenueTables/buildTableOccupancySummary'

export async function buildWeeklyTableOccupancy(
  db: Db,
  startDate: string,
  endDate: string,
  locationId: string,
): Promise<WeeklyTableOccupancySummary> {
  const occ = await buildTableOccupancySummary(db, {
    startDate,
    endDate,
    locationId: locationId === 'all' ? undefined : locationId,
    period: 'weekly',
  })

  return {
    activeTables: occ.activeTables,
    totalTables: occ.totalTables,
    occupancyPct: occ.occupancyPct,
    aggregation: occ.aggregation ?? 'avg_daily',
    venues: occ.venues.map((v) => ({
      locationId: v.locationId,
      locationName: v.locationName,
      activeTables: v.activeTables,
      totalTables: v.totalTables,
      occupancyPct: v.occupancyPct,
    })),
  }
}
