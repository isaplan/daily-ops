/**
 * @registry-id: dailyOpsVenueStripLiveRevenue
 * @created: 2026-06-06T18:00:00.000Z
 * @last-modified: 2026-06-06T18:00:00.000Z
 * @description: Today-only venue revenue from live Bork V2 aggregates (not sealed snapshot)
 * @last-fix: [2026-06-06] ADR-004 exception: today reads bork_business_days_v2 directly
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/venueStrip/snapshotBatch.ts
 * ✓ server/utils/dailyOpsSnapshot/dashboardBundle/patchTodayRevenueFromBork.ts
 */

import type { Db } from 'mongodb'
import type { VenueStripCardDto } from '~/types/daily-ops-dashboard'
import { calendarYmdInAmsterdam } from '~/utils/dailyOpsBusinessDate'
import { proportionalFoodBeverageToHeadline } from '../borkFoodBeverageSplit'
import { fetchBorkRangeTotals } from '../dailyOpsRevenue/borkRevenueRead'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function isTodayBusinessDate(ymd: string): boolean {
  return ymd === calendarYmdInAmsterdam(new Date())
}

/** Live Bork aggregate revenue for one venue-day (today only). */
export async function fetchVenueStripLiveRevenue(
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<VenueStripCardDto['revenue'] | null> {
  if (!isTodayBusinessDate(businessDate)) return null

  const live = await fetchBorkRangeTotals(db, {
    startDate: businessDate,
    endDate: businessDate,
    locationId,
  })

  if (live.revenue <= 0 && live.revenueIncVat <= 0) return null

  const scaledEx = proportionalFoodBeverageToHeadline(live.revenue, live.foodRevenue, live.beverageRevenue)
  const scaledInc = proportionalFoodBeverageToHeadline(
    live.revenueIncVat,
    live.foodRevenue,
    live.beverageRevenue,
  )

  return {
    total: round2(live.revenue),
    food: round2(scaledEx.food),
    beverage: round2(scaledEx.beverage),
    totalIncVat: round2(live.revenueIncVat),
    foodIncVat: round2(scaledInc.food),
    beverageIncVat: round2(scaledInc.beverage),
  }
}
