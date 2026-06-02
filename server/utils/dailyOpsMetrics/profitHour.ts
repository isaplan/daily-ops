/**
 * @registry-id: dailyOpsMetricsProfitHour
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-31T12:00:00.000Z
 * @description: Most-profitable-hour math for Daily Ops revenue breakdown DTOs
 * @last-fix: [2026-05-31] Profit COGS/overhead driven by Mongo P&L assumptions SSOT
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsMetrics/dtoBuilders.ts
 * ✓ server/utils/dailyOpsDashboardMetrics.ts (barrel)
 * ✓ server/utils/dailyOpsSnapshot/buildProfitByIntervalFromSnapshot.ts
 */

import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'
import { DEFAULT_PNL_ASSUMPTIONS } from '~/utils/dailyOpsPnlAssumptionsDefaults'
import { roundDashboardEur } from '~/utils/dashboardEurFormat'
import type { DailyOpsLabMap } from './types'

export type ProfitHourDefaults = {
  foodCogsPct: number
  beverageCogsPct: number
  fixedOverheadPct: number
}

export function profitHourDefaultsFromPnlAssumptions(
  assumptions: DailyOpsSimplePnLAssumptions = DEFAULT_PNL_ASSUMPTIONS,
): ProfitHourDefaults {
  return {
    foodCogsPct: assumptions.foodCogsPct / 100,
    beverageCogsPct: assumptions.bevCogsPct / 100,
    fixedOverheadPct: assumptions.overheadPct / 100,
  }
}

export function formatProfitEstimatesNote(assumptions: DailyOpsSimplePnLAssumptions): string {
  return (
    `Labor from Eitje shift start/end (loaded cost, Amsterdam hour). ` +
    `Cost of sales: food ${assumptions.foodCogsPct}% / beverages ${assumptions.bevCogsPct}% ` +
    `when product COGS is unknown (period food–drink mix). ` +
    `Fixed overhead ${assumptions.overheadPct}% of hour revenue.`
  )
}

function timePeriodKey(hour: number): 'lunch' | 'pre_drinks' | 'dinner' | 'after_drinks' | 'other' {
  if (hour >= 11 && hour <= 14) return 'lunch'
  if (hour >= 15 && hour <= 16) return 'pre_drinks'
  if (hour >= 17 && hour <= 21) return 'dinner'
  if (hour >= 22 || hour <= 3) return 'after_drinks'
  return 'other'
}

export function revenueByTimePeriodFromHourTotals(rows: { _id: number; amount: number }[]) {
  const sums = { lunch: 0, pre_drinks: 0, dinner: 0, after_drinks: 0, other: 0 }
  for (const r of rows) {
    sums[timePeriodKey(Number(r._id))] += r.amount
  }
  return sums
}

export const MOST_PROFITABLE_HOUR_DEFAULTS = profitHourDefaultsFromPnlAssumptions(DEFAULT_PNL_ASSUMPTIONS)

export const MOST_PROFITABLE_HOUR_ESTIMATES_NOTE = formatProfitEstimatesNote(DEFAULT_PNL_ASSUMPTIONS)

export type MostProfitableHourResult = {
  hourLabel: string
  date: string
  hour: number
  revenue: number
  laborCost: number
  cogsCost: number
  fixedCost: number
  profit: number
}

const EMPTY_PROFIT_HOUR: MostProfitableHourResult = {
  hourLabel: '—',
  date: '',
  hour: 0,
  revenue: 0,
  laborCost: 0,
  cogsCost: 0,
  fixedCost: 0,
  profit: 0,
}

export function computeProfitExtremeHours(
  hourRows: { _id: { d: string; h: number }; revenue: number }[],
  revenueByDate: Map<string, number>,
  laborByDate: DailyOpsLabMap,
  categoryTotals: { food: number; drinks: number },
  laborByDateHour: Map<string, number>,
  defaults: ProfitHourDefaults = MOST_PROFITABLE_HOUR_DEFAULTS,
): { best: MostProfitableHourResult; worst: MostProfitableHourResult } {
  const catTotal = categoryTotals.food + categoryTotals.drinks
  const foodShare = catTotal > 0 ? categoryTotals.food / catTotal : 0.5

  const dayRevFromHours = new Map<string, number>()
  for (const row of hourRows) {
    dayRevFromHours.set(row._id.d, (dayRevFromHours.get(row._id.d) ?? 0) + row.revenue)
  }

  let periodLabor = 0
  let periodRev = 0
  for (const [d, rev] of revenueByDate) {
    periodRev += rev
    periodLabor += laborByDate.get(d)?.laborCost ?? 0
  }
  if (periodRev <= 0) {
    for (const [, rev] of dayRevFromHours) periodRev += rev
  }

  let best: MostProfitableHourResult | null = null
  let worst: MostProfitableHourResult | null = null

  for (const row of hourRows) {
    const day = row._id.d
    const h = row._id.h
    const rev = row.revenue
    if (rev <= 0) continue

    const dayRev = revenueByDate.get(day) ?? dayRevFromHours.get(day) ?? 0
    const hourKey = `${day}|${h}`
    let laborAlloc = laborByDateHour.get(hourKey) ?? 0
    if (laborAlloc <= 0) {
      let dayLab = laborByDate.get(day)?.laborCost ?? 0
      if (dayLab <= 0 && dayRev > 0 && periodLabor > 0 && periodRev > 0) {
        dayLab = periodLabor * (dayRev / periodRev)
      }
      laborAlloc = dayLab * (dayRev > 0 ? rev / dayRev : 0)
    }

    const foodRev = rev * foodShare
    const bevRev = rev - foodRev
    const cogs = foodRev * defaults.foodCogsPct + bevRev * defaults.beverageCogsPct
    const fixed = rev * defaults.fixedOverheadPct
    const profit = rev - laborAlloc - cogs - fixed

    const snapshot: MostProfitableHourResult = {
      hourLabel: `${day} ${String(h).padStart(2, '0')}:00`,
      date: day,
      hour: h,
      revenue: rev,
      laborCost: laborAlloc,
      cogsCost: cogs,
      fixedCost: fixed,
      profit,
    }

    if (!best || profit > best.profit) best = snapshot
    if (!worst || profit < worst.profit) worst = snapshot
  }

  return { best: best ?? EMPTY_PROFIT_HOUR, worst: worst ?? EMPTY_PROFIT_HOUR }
}

export function computeMostProfitableHour(
  hourRows: { _id: { d: string; h: number }; revenue: number }[],
  revenueByDate: Map<string, number>,
  laborByDate: DailyOpsLabMap,
  categoryTotals: { food: number; drinks: number },
  laborByDateHour: Map<string, number>,
  defaults: ProfitHourDefaults = MOST_PROFITABLE_HOUR_DEFAULTS,
): MostProfitableHourResult {
  return computeProfitExtremeHours(
    hourRows,
    revenueByDate,
    laborByDate,
    categoryTotals,
    laborByDateHour,
    defaults,
  ).best
}

export function roundProfitHourSnapshot(
  row: MostProfitableHourResult,
  assumptions: DailyOpsSimplePnLAssumptions = DEFAULT_PNL_ASSUMPTIONS,
) {
  return {
    hourLabel: row.hourLabel,
    date: row.date,
    hour: row.hour,
    revenue: roundDashboardEur(row.revenue),
    laborCost: roundDashboardEur(row.laborCost),
    cogsCost: roundDashboardEur(row.cogsCost),
    fixedCost: roundDashboardEur(row.fixedCost),
    profit: roundDashboardEur(row.profit),
    estimatesNote: formatProfitEstimatesNote(assumptions),
  }
}
