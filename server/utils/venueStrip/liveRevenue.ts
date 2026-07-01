/**
 * @registry-id: dailyOpsVenueStripLiveRevenue
 * @created: 2026-06-06T18:00:00.000Z
 * @last-modified: 2026-07-01T12:00:00.000Z
 * @description: Open register-day venue revenue — Bork order-time aggregates (order-entry hour)
 * @last-fix: [2026-07-01] Today headline uses bork_sales_by_order_hour, not paid business-day totals
 *   Prior: [2026-06-08] Bounded raw scan via sumBusinessDateFromBorkRawBounded (4s cap)
 * @adr-ref: ADR-004, ADR-010
 *
 * @architecture:
 *   - “Today” = open register `business_date` (08:00 → next morning 07:59).
 *   - Headline = sum of order-time hour buckets (matches Datalab “orders now”).
 *
 * @exports-to:
 * ✓ server/utils/venueStrip/snapshotBatch.ts
 * ✓ server/utils/dailyOpsSnapshot/dashboardBundle/patchTodayRevenueFromBork.ts
 */

import type { Db } from 'mongodb'
import type { VenueStripCardDto } from '~/types/daily-ops-dashboard'
import { isOpenRegisterBusinessDate } from '~/utils/dailyOpsBusinessDate'
import { proportionalFoodBeverageToHeadline } from '../borkFoodBeverageSplit'
import { fetchBorkOrderTimeRangeTotals } from '../dailyOpsRevenue/borkRevenueRead'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** True when `ymd` is the open register business day (ADR-010). */
export function isTodayBusinessDate(ymd: string): boolean {
  return isOpenRegisterBusinessDate(ymd)
}

/** Live Bork order-time revenue for one venue × open register business day. */
export async function fetchVenueStripLiveRevenue(
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<VenueStripCardDto['revenue'] | null> {
  if (!isTodayBusinessDate(businessDate)) return null

  const agg = await fetchBorkOrderTimeRangeTotals(db, {
    startDate: businessDate,
    endDate: businessDate,
    locationId,
  })

  const revenue = agg.revenue
  const revenueIncVat = agg.revenueIncVat

  if (revenue <= 0 && revenueIncVat <= 0) return null

  const scaledEx = proportionalFoodBeverageToHeadline(revenue, agg.foodRevenue, agg.beverageRevenue)
  const scaledInc = proportionalFoodBeverageToHeadline(
    revenueIncVat,
    agg.foodRevenue,
    agg.beverageRevenue,
  )

  return {
    total: round2(revenue),
    food: round2(scaledEx.food),
    beverage: round2(scaledEx.beverage),
    totalIncVat: round2(revenueIncVat),
    foodIncVat: round2(scaledInc.food),
    beverageIncVat: round2(scaledInc.beverage),
  }
}
