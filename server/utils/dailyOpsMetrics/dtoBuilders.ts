/**
 * @registry-id: dailyOpsMetricsDtoBuilders
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Daily Ops dashboard summary + revenue breakdown DTO builders (snapshot inputs)
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsDashboardMetrics.ts (barrel)
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import {
  resolveVenueDayHeadlineRevenue,
  type BasisReportData,
} from '../inbox/basis-report-mapper'
import type {
  DailyOpsProfitByIntervalDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
} from '~/types/daily-ops-dashboard'
import type { DailyOpsMetricsContext } from './context'
import {
  computeMostProfitableHour,
  revenueByTimePeriodFromHourTotals,
  roundProfitHourSnapshot,
} from './profitHour'
import type { BorkHourAggregatesBundle, DailyOpsLabMap, TodayRevenueExtras } from './types'

export const VAT_DISCLAIMER = 'All revenue values shown are excluding VAT (ex VAT)'

function resolveHeadlineRevenue(
  apiMergedTotal: number,
  revenueSourcesDetail?: { inboxBasisExVat: number | null },
): { headline: number; leadSource: 'inbox_basis_ex_vat' | 'bork_api_merged' } {
  const inboxEx = revenueSourcesDetail?.inboxBasisExVat ?? 0
  const resolved = resolveVenueDayHeadlineRevenue({
    inboxReports:
      inboxEx > 0 ? [{ final_revenue_ex_vat: inboxEx, cron_hour: 8 } as BasisReportData] : [],
    bork: { ex_vat: apiMergedTotal, inc_vat: 0, vat: 0, quantity: 0, record_count: 0 },
    hasBorkDay: apiMergedTotal > 0,
  })
  return {
    headline: Math.round(resolved.totals.ex_vat * 100) / 100,
    leadSource: resolved.leadSource === 'inbox' ? 'inbox_basis_ex_vat' : 'bork_api_merged',
  }
}

export function buildDailyOpsSummaryDto(
  ctx: DailyOpsMetricsContext,
  revMap: Map<string, number>,
  labMap: DailyOpsLabMap,
  revenueSourcesDetail?: {
    apiBusinessDaysTotal: number
    inboxBasisExVat: number | null
  },
): DailyOpsSummaryDto {
  let apiMergedTotal = 0
  for (const v of revMap.values()) apiMergedTotal += v
  const { headline: totalRevenue, leadSource } = resolveHeadlineRevenue(
    apiMergedTotal,
    revenueSourcesDetail,
  )
  let totalLaborCost = 0
  let totalLaborHours = 0
  for (const v of labMap.values()) {
    totalLaborCost += v.laborCost
    totalLaborHours += v.hours
  }
  const profit = totalRevenue - totalLaborCost
  const profitMarginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0
  const revenuePerLaborHour = totalLaborHours > 0 ? totalRevenue / totalLaborHours : null
  const laborCostPctOfRevenue = totalRevenue > 0 ? (totalLaborCost / totalRevenue) * 100 : null

  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    summary: {
      totalRevenue,
      totalLaborCost: Math.round(totalLaborCost * 100) / 100,
      totalLaborHours: Math.round(totalLaborHours * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitMarginPct: Math.round(profitMarginPct * 10) / 10,
      revenuePerLaborHour:
        revenuePerLaborHour != null ? Math.round(revenuePerLaborHour * 100) / 100 : null,
      laborCostPctOfRevenue:
        laborCostPctOfRevenue != null ? Math.round(laborCostPctOfRevenue * 10) / 10 : null,
      revenueLeadSource: revenueSourcesDetail ? leadSource : undefined,
      revenueSources: revenueSourcesDetail
        ? {
            apiBusinessDaysTotal: revenueSourcesDetail.apiBusinessDaysTotal,
            inboxBasisExVat: revenueSourcesDetail.inboxBasisExVat,
          }
        : undefined,
    },
    vatDisclaimer: VAT_DISCLAIMER,
  }
}

export function buildDailyOpsRevenueBreakdownDto(
  ctx: DailyOpsMetricsContext,
  cat: { drinks: number; food: number },
  hourBundle: BorkHourAggregatesBundle,
  revMap: Map<string, number>,
  labMap: DailyOpsLabMap,
  laborByDateHour: Map<string, number>,
  profitByInterval: DailyOpsProfitByIntervalDto,
  todayExtras?: TodayRevenueExtras,
): DailyOpsRevenueBreakdownDto {
  const tp = revenueByTimePeriodFromHourTotals(hourBundle.byHourOnly)
  const best = computeMostProfitableHour(
    hourBundle.byDayHour,
    revMap,
    labMap,
    cat,
    laborByDateHour,
  )

  const revenueByCategory = [
    { key: 'drinks', label: 'Drinks', amount: Math.round(cat.drinks * 100) / 100 },
    { key: 'food', label: 'Food', amount: Math.round(cat.food * 100) / 100 },
  ]

  const revenueByTimePeriod: { key: string; label: string; amount: number }[] = [
    { key: 'lunch', label: 'Lunch', amount: Math.round(tp.lunch * 100) / 100 },
    { key: 'pre_drinks', label: 'Pre Drinks', amount: Math.round(tp.pre_drinks * 100) / 100 },
    { key: 'dinner', label: 'Dinner', amount: Math.round(tp.dinner * 100) / 100 },
    { key: 'after_drinks', label: 'After Drinks', amount: Math.round(tp.after_drinks * 100) / 100 },
  ]
  if (tp.other > 0) {
    revenueByTimePeriod.push({
      key: 'other',
      label: 'Other hours',
      amount: Math.round(tp.other * 100) / 100,
    })
  }

  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    revenueByCategory,
    revenueByTimePeriod,
    mostProfitableHour: roundProfitHourSnapshot(best),
    profitByInterval,
    todayRevenueDetail: todayExtras
      ? {
          apiHourlyByCalendarHour: todayExtras.apiHourlyByCalendarHour,
          orderHourlyByCalendarHour: todayExtras.orderHourlyByCalendarHour,
          inboxBasisCronSnapshots: todayExtras.inboxBasisCronSnapshots,
        }
      : undefined,
  }
}
