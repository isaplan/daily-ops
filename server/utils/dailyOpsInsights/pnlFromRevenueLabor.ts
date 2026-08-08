/**
 * @registry-id: dailyOpsInsightsPnl
 * @created: 2026-06-25T20:00:00.000Z
 * @last-modified: 2026-08-05T00:05:00.000Z
 * @description: SSOT estimated net P&L from headline revenue + loaded labor (ADR-014)
 * @last-fix: [2026-08-05] ADR-014 amended: sealed Finance vs open assumptions; labor = employer load (020)
 * @adr-ref: ADR-004, ADR-013, ADR-014, ADR-020, ADR-022
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsInsights/buildPerformanceInsights.ts
 * ✓ server/utils/dailyOpsMetrics/dtoBuilders.ts
 * ✓ server/utils/dailyOpsSnapshot/aggregateDailyBundles.ts
 * ✓ server/utils/dailyOpsSnapshot/buildPeriodBreakdown.ts
 * ✓ server/utils/dailyOpsSnapshot/buildProfitByIntervalFromSnapshot.ts
 * ✓ server/utils/dailyOpsSnapshot/drilldown/buildRevenueDrilldownHourly.ts
 * ✓ server/utils/dailyOpsRevenue/computeSimplePnL.ts
 */

import type { DailyOpsDashboardBundleDto } from '~/server/utils/dailyOpsSnapshot/fetchDashboardBundle'
import { profitHourDefaultsFromPnlAssumptions } from '~/server/utils/dailyOpsMetrics/profitHour'
import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'
import { DEFAULT_PNL_ASSUMPTIONS } from '~/utils/dailyOpsPnlAssumptionsDefaults'
import { roundDashboardEur } from '~/utils/dashboardEurFormat'

export type HeadlinePnlSlice = {
  cogs: number
  fixed_overhead: number
  gross_profit: number
  net_profit: number
}

export type PnlCategoryTotals = {
  food: number
  drinks: number
}

export type PeriodBreakdownPnlContext = {
  assumptions: DailyOpsSimplePnLAssumptions
  categoryTotals: PnlCategoryTotals
}

export function foodShareFromCategoryTotals(categoryTotals: PnlCategoryTotals): number {
  const total = categoryTotals.food + categoryTotals.drinks
  return total > 0 ? categoryTotals.food / total : 0.5
}

/** Core net-profit formula — all dashboard profit surfaces must call this (ADR-014). */
export function pnlFromRevenueLabor(
  revenue: number,
  loadedLabor: number,
  foodShare: number,
  assumptions: DailyOpsSimplePnLAssumptions = DEFAULT_PNL_ASSUMPTIONS,
): HeadlinePnlSlice {
  const profitDefaults = profitHourDefaultsFromPnlAssumptions(assumptions)
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

export function netProfitFromHeadline(
  revenue: number,
  loadedLabor: number,
  categoryTotals: PnlCategoryTotals,
  assumptions: DailyOpsSimplePnLAssumptions = DEFAULT_PNL_ASSUMPTIONS,
): number {
  return pnlFromRevenueLabor(
    revenue,
    loadedLabor,
    foodShareFromCategoryTotals(categoryTotals),
    assumptions,
  ).net_profit
}

export function categoryTotalsFromRevenueByCategory(
  revenueByCategory: { key: string; amount: number }[] | undefined,
): PnlCategoryTotals {
  let food = 0
  let drinks = 0
  for (const row of revenueByCategory ?? []) {
    if (row.key === 'food') food += row.amount
    else if (row.key === 'drinks') drinks += row.amount
  }
  return { food, drinks }
}

export function categoryTotalsFromBundleRevenue(bundle: DailyOpsDashboardBundleDto): PnlCategoryTotals {
  return categoryTotalsFromRevenueByCategory(bundle.revenue?.revenueByCategory)
}

export function aggregateCategoryTotalsFromBundles(
  bundles: DailyOpsDashboardBundleDto[],
): PnlCategoryTotals {
  return bundles.reduce<PnlCategoryTotals>(
    (acc, bundle) => {
      const cat = categoryTotalsFromBundleRevenue(bundle)
      return { food: acc.food + cat.food, drinks: acc.drinks + cat.drinks }
    },
    { food: 0, drinks: 0 },
  )
}

export function defaultPeriodBreakdownPnlContext(): PeriodBreakdownPnlContext {
  return {
    assumptions: { ...DEFAULT_PNL_ASSUMPTIONS },
    categoryTotals: { food: 0, drinks: 0 },
  }
}
