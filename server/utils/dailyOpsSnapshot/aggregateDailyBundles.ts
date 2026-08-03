/**
 * @registry-id: dailyOpsAggregateBundles
 * @created: 2026-06-05T18:48:00.000Z
 * @last-modified: 2026-07-16T00:00:00.000Z
 * @description: Aggregate multiple daily dashboard bundles into weekly/monthly/yearly totals
 * @last-fix: [2026-07-16] Keep profitByInterval on totalsOnly rollups; strip day-only extras
 *   Prior: [2026-07-14] Rollup profit via ADR-014 net-profit SSOT
 * @adr-ref: ADR-004, ADR-008, ADR-010, ADR-013, ADR-014
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/cacheCascade.ts
 */

import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import type { DailyOpsProfitHourDto, VenueStripResponseDto } from '~/types/daily-ops-dashboard'
import { mergeVenueStripResponses } from '../venueStrip/mergeCards'
import { averageTableOccupancyPayloads } from '../dailyOpsVenueTables/buildTableOccupancySummary'
import { coverageFromDailyBundles, formatCoverageNote } from './bundleCoverage'
import { mergeProfitByIntervalDtos } from './mergeProfitByInterval'
import { mergeDrilldownDtos } from './mergeDrilldown'
import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'
import {
  aggregateCategoryTotalsFromBundles,
  netProfitFromHeadline,
} from '~/server/utils/dailyOpsInsights/pnlFromRevenueLabor'
import { DEFAULT_PNL_ASSUMPTIONS } from '~/utils/dailyOpsPnlAssumptionsDefaults'
import { aggregatePeriodBreakdown, applyOccupancyToPeriodBreakdown } from './buildPeriodBreakdown'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function mergeRevenueByCategory(bundles: DailyOpsDashboardBundleDto[]) {
  const totals = aggregateCategoryTotalsFromBundles(bundles)
  return [
    { key: 'drinks', label: 'Drinks', amount: round2(totals.drinks) },
    { key: 'food', label: 'Food', amount: round2(totals.food) },
  ]
}

export type AggregateDailyBundlesPeriod = {
  startDate: string
  endDate: string
  label?: string
  totalsOnly?: boolean
  pnlAssumptions?: DailyOpsSimplePnLAssumptions
}

/** Aggregate multiple daily bundles into a single period bundle (week/month/year). */
export function aggregateDailyBundles(
  dailyBundles: DailyOpsDashboardBundleDto[],
  period: AggregateDailyBundlesPeriod,
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

  const assumptions = period.pnlAssumptions ?? DEFAULT_PNL_ASSUMPTIONS
  const categoryTotals = aggregateCategoryTotalsFromBundles(dailyBundles)
  const profit = netProfitFromHeadline(totalRevenue, totalLaborCost, categoryTotals, assumptions)
  const profitMarginPct = totalRevenue > 0 ? round2((profit / totalRevenue) * 100) : 0
  const revenuePerLaborHour = totalLaborHours > 0 ? round2(totalRevenue / totalLaborHours) : null
  const laborCostPctOfRevenue = totalRevenue > 0 ? round2((totalLaborCost / totalRevenue) * 100) : 0

  // Use first bundle as template, override aggregated values
  const first = dailyBundles[0]!
  const stripParts = dailyBundles
    .map((b) => b.venueStrip)
    .filter((s): s is VenueStripResponseDto => !!s?.venues?.length)

  let venueStrip: VenueStripResponseDto | undefined
  if (stripParts.length === 1) {
    venueStrip = {
      ...stripParts[0]!,
      range: { period: period.label ?? 'custom', startDate: period.startDate, endDate: period.endDate },
    }
  }
  else if (stripParts.length > 1) {
    venueStrip = mergeVenueStripResponses(stripParts, {
      period: period.label ?? 'custom',
      startDate: period.startDate,
      endDate: period.endDate,
    })
  }

  const snapshotCoverage = coverageFromDailyBundles(dailyBundles, period.startDate, period.endDate)
  const coverageNote = formatCoverageNote(snapshotCoverage)
  const totalsOnly = period.totalsOnly === true

  /** Daypart P&L donuts need interval cells on week/month/year — never drop for totalsOnly. */
  const profitByInterval = mergeProfitByIntervalDtos(
    dailyBundles.map((b) => b.revenue?.profitByInterval),
  )
  if (profitByInterval && coverageNote) {
    profitByInterval.coverageNote = coverageNote
    profitByInterval.estimatesNote = `${profitByInterval.estimatesNote} ${coverageNote}`
  }

  const drilldown = totalsOnly
    ? undefined
    : mergeDrilldownDtos(
        dailyBundles.map((b) => b.revenue?.drilldown),
        { coverageNote, multiDayRange: period.startDate !== period.endDate },
      )

  const emptyProfitHour: DailyOpsProfitHourDto = {
    hourLabel: '—',
    date: '',
    hour: 0,
    revenue: 0,
    laborCost: 0,
    cogsCost: 0,
    fixedCost: 0,
    profit: 0,
    estimatesNote: 'Most profitable hour is day-only — omitted for multi-day periods.',
  }

  const periodBreakdownRaw = aggregatePeriodBreakdown(dailyBundles, period.startDate, period.endDate, {
    assumptions,
    categoryTotals,
  })
  if (periodBreakdownRaw && coverageNote) {
    periodBreakdownRaw.coverageNote = coverageNote
  }

  const occupancyParts = dailyBundles
    .map((b) => b.tableOccupancy)
    .filter((o): o is NonNullable<typeof o> => o != null)
  const tableOccupancy = averageTableOccupancyPayloads(occupancyParts, {
    period: 'custom',
    startDate: period.startDate,
    endDate: period.endDate,
  })

  const periodBreakdown = periodBreakdownRaw
    ? applyOccupancyToPeriodBreakdown(periodBreakdownRaw, tableOccupancy)
    : undefined

  return {
    summary: {
      ...first.summary,
      snapshotCoverage,
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
      revenueByCategory: mergeRevenueByCategory(dailyBundles),
      todayRevenueDetail: undefined,
      mostProfitableHour: emptyProfitHour,
      profitByInterval,
      drilldown,
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
    venueStrip,
    periodBreakdown,
    tableOccupancy,
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

/** ISO week start (Monday) for a business_date YMD. */
export function getWeekStart(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  const dow = date.getUTCDay()
  const diff = dow === 0 ? -6 : 1 - dow
  return addCalendarDaysYmd(ymd, diff)
}

/** ISO week end (Sunday) for a business_date YMD. */
export function getWeekEnd(ymd: string): string {
  return addCalendarDaysYmd(getWeekStart(ymd), 6)
}

export function monthEndYmd(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  return `${monthKey}-${String(lastDay).padStart(2, '0')}`
}

export function maxYmd(a: string, b: string): string {
  return a >= b ? a : b
}

export function minYmd(a: string, b: string): string {
  return a <= b ? a : b
}

/** List YYYY-MM keys from startDate through endDate inclusive. */
export function enumerateMonthKeys(startDate: string, endDate: string): string[] {
  const out: string[] = []
  let cursor = getMonthKey(startDate)
  const endMonth = getMonthKey(endDate)
  while (cursor <= endMonth) {
    out.push(cursor)
    const [y, m] = cursor.split('-').map(Number)
    const next = m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, '0')}`
    cursor = next
  }
  return out
}
