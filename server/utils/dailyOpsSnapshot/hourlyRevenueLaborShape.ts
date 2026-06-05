/**
 * @registry-id: dailyOpsHourlyRevenueLaborShape
 * @created: 2026-06-05T00:00:00.000Z
 * @last-modified: 2026-06-05T00:00:00.000Z
 * @description: Redistribute sealed-day headline revenue across labor hours when snapshot hourly is sparse
 * @last-fix: [2026-06-05] Shared helper for drilldown + today revenue detail fallbacks
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/dashboardBundle/todayRevenueDetail.ts
 * ✓ server/utils/dailyOpsSnapshot/drilldown/buildRevenueDrilldownHourly.ts
 */

import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import { laborBucketForLocationHour } from './dashboardBundle/laborHourMaps'
import type { SnapshotLaborByBusinessDateHourBucket } from './dashboardBundle/laborHourMaps'
import { locDayKey } from './drilldown/drilldownShared'
import { snapshotRound2 } from './dashboardBundle/shared'

export type HourlyRevenueMaps = {
  byHour: Map<number, number>
  byLocationHour: Map<string, number>
}

export function countRevenueHours(revenueByHour: Map<number, number>): number {
  let count = 0
  for (const value of revenueByHour.values()) {
    if (value > 0) count += 1
  }
  return count
}

export function shouldRedistributeSparseHourlyRevenue(
  dateStr: string,
  revenueByHour: Map<number, number>,
  headlineRevenueByLocDay: Map<string, number>,
): boolean {
  if (dateStr >= amsterdamOpenRegisterBusinessDateYmd()) return false

  const headlineTotal = VENUE_STRIP_LOCATIONS.reduce(
    (sum, location) => sum + (headlineRevenueByLocDay.get(locDayKey(dateStr, location.locationId)) ?? 0),
    0,
  )
  if (headlineTotal <= 0) return false

  if (revenueByHour.size === 0) return true

  const hourlyTotal = [...revenueByHour.values()].reduce((sum, value) => sum + value, 0)
  return countRevenueHours(revenueByHour) <= 2 && hourlyTotal > 0
}

export function redistributeRevenueByLaborHours(
  dateStr: string,
  headlineRevenueByLocDay: Map<string, number>,
  laborByLocHour: Map<string, SnapshotLaborByBusinessDateHourBucket>,
): HourlyRevenueMaps {
  const byHour = new Map<number, number>()
  const byLocationHour = new Map<string, number>()

  for (const location of VENUE_STRIP_LOCATIONS) {
    const target = headlineRevenueByLocDay.get(locDayKey(dateStr, location.locationId)) ?? 0
    if (target <= 0) continue

    let laborTotal = 0
    const hourLabor: Array<{ hour: number; hours: number }> = []
    for (let hour = 0; hour < 24; hour += 1) {
      const bucket = laborBucketForLocationHour(laborByLocHour, location.locationId, dateStr, hour)
      if (bucket.hours <= 0) continue
      hourLabor.push({ hour, hours: bucket.hours })
      laborTotal += bucket.hours
    }
    if (laborTotal <= 0) continue

    for (const { hour, hours } of hourLabor) {
      const rev = snapshotRound2(target * (hours / laborTotal))
      if (rev <= 0) continue
      byHour.set(hour, snapshotRound2((byHour.get(hour) ?? 0) + rev))
      const locHourKey = `${location.locationId}|${hour}`
      byLocationHour.set(locHourKey, snapshotRound2((byLocationHour.get(locHourKey) ?? 0) + rev))
    }
  }

  return { byHour, byLocationHour }
}
