import { getDb } from '../../utils/db'
import {
  VAT_DISCLAIMER,
  buildDailyOpsSummaryDto,
  fetchBorkHourAggregatesBundle,
  fetchLaborByDate,
  fetchRevenueByCategoryFromHourAggregates,
  fetchRevenueByDate,
  parseDailyOpsMetricsQuery,
  revenueByTimePeriodFromHourTotals,
  computeMostProfitableHour,
} from '../../utils/dailyOpsDashboardMetrics'
import type { DailyOpsOverviewDto } from '~/types/daily-ops-dashboard'

/** @deprecated Prefer /api/daily-ops/metrics/* for smaller, parallel responses. */
export default defineEventHandler(async (event): Promise<DailyOpsOverviewDto> => {
  setResponseHeader(event, 'Cache-Control', 'private, max-age=30, stale-while-revalidate=120')
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()

  const [cat, hourBundle, revenueByDate, laborByDate] = await Promise.all([
    fetchRevenueByCategoryFromHourAggregates(db, ctx),
    fetchBorkHourAggregatesBundle(db, ctx),
    fetchRevenueByDate(db, ctx),
    fetchLaborByDate(db, ctx),
  ])

  const summaryDto = buildDailyOpsSummaryDto(ctx, revenueByDate, laborByDate)
  const totalRevenue = summaryDto.summary.totalRevenue
  const totalLaborCost = summaryDto.summary.totalLaborCost
  const profit = summaryDto.summary.profit
  const profitMarginPct = summaryDto.summary.profitMarginPct

  const tp = revenueByTimePeriodFromHourTotals(hourBundle.byHourOnly)
  const best = computeMostProfitableHour(hourBundle.byDayHour, revenueByDate, laborByDate)

  const revenueByCategory = [
    { key: 'drinks', label: 'Drinks', amount: Math.round(cat.drinks * 100) / 100 },
    { key: 'food', label: 'Food', amount: Math.round(cat.food * 100) / 100 },
  ]

  const revenueByTimePeriod = [
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
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalLaborCost: Math.round(totalLaborCost * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitMarginPct: Math.round(profitMarginPct * 10) / 10,
    },
    revenueByCategory,
    revenueByTimePeriod,
    mostProfitableHour: {
      hourLabel: best.hourLabel,
      date: best.date,
      revenue: Math.round(best.revenue * 100) / 100,
      laborCost: Math.round(best.laborCost * 100) / 100,
      profit: Math.round(best.profit * 100) / 100,
    },
    vatDisclaimer: VAT_DISCLAIMER,
  }
})
