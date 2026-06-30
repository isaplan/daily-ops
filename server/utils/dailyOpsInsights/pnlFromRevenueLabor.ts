/**
 * @registry-id: dailyOpsInsightsPnl
 * @created: 2026-06-25T20:00:00.000Z
 * @last-modified: 2026-06-25T20:00:00.000Z
 * @description: Estimated P&L from headline revenue + loaded labor (50/50 food/bev COGS split)
 * @last-fix: [2026-06-25] Shared headline P&L for insights aggregation
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsInsights/buildPerformanceInsights.ts
 */

import type { ProfitHourDefaults } from '~/server/utils/dailyOpsMetrics/profitHour'
import { roundDashboardEur } from '~/utils/dashboardEurFormat'

export type HeadlinePnlSlice = {
  cogs: number
  fixed_overhead: number
  gross_profit: number
  net_profit: number
}

/** Same math as buildProfitByIntervalFromSnapshot dayPnlFromHeadline (unknown product mix → 50/50). */
export function pnlFromRevenueLabor(
  revenue: number,
  loadedLabor: number,
  foodShare: number,
  profitDefaults: ProfitHourDefaults,
): HeadlinePnlSlice {
  const foodRev = revenue * foodShare
  const bevRev = revenue - foodRev
  const cogs = roundDashboardEur(
    foodRev * profitDefaults.foodCogsPct + bevRev * profitDefaults.beverageCogsPct,
  )
  const fixed_overhead = roundDashboardEur(revenue * profitDefaults.fixedOverheadPct)
  const gross_profit = roundDashboardEur(revenue - loadedLabor - cogs)
  const net_profit = roundDashboardEur(revenue - loadedLabor - cogs - fixed_overhead)
  return { cogs, fixed_overhead, gross_profit, net_profit }
}
