/**
 * @registry-id: dailyOpsAggregateBundles
 * @created: 2026-06-05T18:48:00.000Z
 * @last-modified: 2026-06-05T18:48:00.000Z
 * @description: Aggregate multiple daily dashboard bundles into weekly/monthly/yearly totals
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/cacheCascade.ts
 */

import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Aggregate multiple daily bundles into a single period bundle (week/month/year). */
export function aggregateDailyBundles(
  dailyBundles: DailyOpsDashboardBundleDto[],
  period: { startDate: string; endDate: string; label?: string },
): DailyOpsDashboardBundleDto {
  if (dailyBundles.length === 0) {
    throw new Error('Cannot aggregate empty bundle array')
  }

  // Aggregate summary totals
  let totalRevenue = 0
  let totalLaborCost = 0
  let totalLaborHours = 0
  let totalWages = 0
  let totalLoaded = 0

  for (const bundle of dailyBundles) {
    totalRevenue += bundle.summary?.summary?.totalRevenue ?? 0
    totalLaborCost += bundle.summary?.summary?.totalLaborCost ?? 0
    totalLaborHours += bundle.summary?.summary?.totalLaborHours ?? 0
    totalWages += bundle.labor?.breakdown?.wages ?? 0
    totalLoaded += bundle.labor?.breakdown?.loaded ?? 0
  }

  const profit = totalRevenue - totalLaborCost
  const profitMarginPct = totalRevenue > 0 ? round2((profit / totalRevenue) * 100) : 0
  const revenuePerLaborHour = totalLaborHours > 0 ? round2(totalRevenue / totalLaborHours) : null
  const laborCostPctOfRevenue = totalRevenue > 0 ? round2((totalLaborCost / totalRevenue) * 100) : 0

  // Use first bundle as template, override aggregated values
  const first = dailyBundles[0]!

  return {
    summary: {
      ...first.summary,
      range: {
        period: 'custom' as any,
        startDate: period.startDate,
        endDate: period.endDate,
      },
      summary: {
        ...first.summary.summary,
        totalRevenue: round2(totalRevenue),
        totalLaborCost: round2(totalLaborCost),
        totalLaborHours: round2(totalLaborHours),
        profit: round2(profit),
        profitMarginPct,
        revenuePerLaborHour,
        laborCostPctOfRevenue,
      },
    },
    revenue: {
      ...first.revenue,
      range: {
        period: 'custom' as any,
        startDate: period.startDate,
        endDate: period.endDate,
      },
      // For multi-day: clear detailed breakdowns, keep only totals
      todayExtras: null,
      profitByInterval: null,
      drilldown: null,
    },
    labor: {
      ...first.labor,
      breakdown: {
        ...first.labor.breakdown,
        wages: round2(totalWages),
        loaded: round2(totalLoaded),
        hours: round2(totalLaborHours),
      },
    },
  }
}

/** ISO week number (W01-W53) for a date. */
export function getIsoWeek(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  
  // ISO week: Thursday in target week determines year
  const thursday = new Date(date)
  thursday.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7))
  const year = thursday.getUTCFullYear()
  
  // Week 1 = first Thursday of year
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekNo = Math.ceil(((thursday.getTime() - jan4.getTime()) / 86400000 + jan4.getUTCDay() + 1) / 7)
  
  return `${year}-W${String(weekNo).padStart(2, '0')}`
}

/** Get month key (YYYY-MM) for a date. */
export function getMonthKey(ymd: string): string {
  return ymd.slice(0, 7) // YYYY-MM
}

/** Get year key (YYYY) for a date. */
export function getYearKey(ymd: string): string {
  return ymd.slice(0, 4) // YYYY
}

/** ISO week start (Monday) for a date. */
export function getWeekStart(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  const dow = date.getUTCDay()
  const diff = dow === 0 ? -6 : 1 - dow
  date.setUTCDate(date.getUTCDate() + diff)
  return date.toISOString().slice(0, 10)
}

/** ISO week end (Sunday) for a date. */
export function getWeekEnd(ymd: string): string {
  const start = getWeekStart(ymd)
  const [y, m, d] = start.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d! + 6))
  return date.toISOString().slice(0, 10)
}
