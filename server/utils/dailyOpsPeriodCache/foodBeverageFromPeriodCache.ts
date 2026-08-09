/**
 * @registry-id: dailyOpsPeriodCacheFoodBeverage
 * @created: 2026-08-09T00:30:00.000Z
 * @last-modified: 2026-08-09T00:30:00.000Z
 * @description: Read food/beverage totals from period-cache day nodes (PERIOD_CACHE_ADR L3)
 * @last-fix: [2026-08-09] Shared loader for venue strip / digests / revenue range
 * @adr-ref: PERIOD_CACHE_ADR L2, L3
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache · level=day
 *
 * @exports-to:
 * ✓ server/utils/venueStrip/snapshotBatch.ts
 * ✓ server/utils/venueStrip/revenue.ts
 * ✓ server/utils/dailyOpsWeeklyReport/buildWeeklyDigest.ts
 * ✓ server/utils/dailyOpsMonthlyReport/buildMonthlyDigest.ts
 * ✓ server/utils/dailyOpsSnapshot/dashboardBundle/hourBundle.ts
 * ✓ server/utils/dailyOpsRevenue/fetchRevenueRange.ts
 */

import type { Db } from 'mongodb'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { findPeriodNode } from './store'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

export async function loadFoodBeverageForDay (
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<{ food: number; beverage: number } | null> {
  const node = await findPeriodNode(db, {
    locationId,
    level: 'day',
    periodKey: businessDate,
  })
  if (!node) return null
  return {
    food: round2(node.revenue.food),
    beverage: round2(node.revenue.beverage),
  }
}

/** Sum day-node food/bev for inclusive range (venue or `all`). */
export async function sumFoodBeverageForRange (
  db: Db,
  opts: { startDate: string; endDate: string; locationId: string },
): Promise<{ food: number; beverage: number; daysFound: number }> {
  let food = 0
  let beverage = 0
  let daysFound = 0
  let cursor = opts.startDate
  while (cursor <= opts.endDate) {
    const hit = await loadFoodBeverageForDay(db, cursor, opts.locationId)
    if (hit) {
      food += hit.food
      beverage += hit.beverage
      daysFound++
    }
    cursor = addCalendarDaysYmd(cursor, 1)
  }
  return { food: round2(food), beverage: round2(beverage), daysFound }
}
