/**
 * @registry-id: dailyOpsVenueStripLiveRevenue
 * @created: 2026-06-06T18:00:00.000Z
 * @last-modified: 2026-06-07T01:00:00.000Z
 * @description: Open register-day venue revenue — freshest of Bork V2 aggregate or live raw sum
 * @last-fix: [2026-06-08] Bounded raw scan via sumBusinessDateFromBorkRawBounded (4s cap)
 *   Prior: [2026-06-07] isTodayBusinessDate uses open register day, not ISO calendar
 * @adr-ref: ADR-004, ADR-010
 *
 * @architecture:
 *   - “Today” = open register `business_date` (08:00 → next morning 07:59).
 *   - Prefer max(aggregate, raw) so hourly cron lag does not under-report vs Datalab/POS.
 *
 * @exports-to:
 * ✓ server/utils/venueStrip/snapshotBatch.ts
 * ✓ server/utils/dailyOpsSnapshot/dashboardBundle/patchTodayRevenueFromBork.ts
 */

import type { Db } from 'mongodb'
import type { VenueStripCardDto } from '~/types/daily-ops-dashboard'
import { isOpenRegisterBusinessDate } from '~/utils/dailyOpsBusinessDate'
import { proportionalFoodBeverageToHeadline } from '../borkFoodBeverageSplit'
import { fetchBorkRangeTotals } from '../dailyOpsRevenue/borkRevenueRead'
import { sumBusinessDateFromBorkRawBounded } from './liveRevenueRaw'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** True when `ymd` is the open register business day (ADR-010). */
export function isTodayBusinessDate(ymd: string): boolean {
  return isOpenRegisterBusinessDate(ymd)
}

/** Live Bork revenue for one venue × open register business day. */
export async function fetchVenueStripLiveRevenue(
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<VenueStripCardDto['revenue'] | null> {
  if (!isTodayBusinessDate(businessDate)) return null

  const [agg, raw] = await Promise.all([
    fetchBorkRangeTotals(db, {
      startDate: businessDate,
      endDate: businessDate,
      locationId,
    }),
    sumBusinessDateFromBorkRawBounded(db, locationId, businessDate),
  ])

  const revenue = Math.max(agg.revenue, raw?.revenue ?? 0)
  const revenueIncVat = Math.max(agg.revenueIncVat, raw?.revenueIncVat ?? 0)

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
