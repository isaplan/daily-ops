import { getDb } from '../../../utils/db'
import {
  computeMostProfitableHour,
  fetchHourlyRevenueForRange,
  fetchLaborByDate,
  fetchRevenueByCategoryFromRaw,
  fetchRevenueByDate,
  fetchRevenueByTimePeriod,
  parseDailyOpsMetricsQuery,
} from '../../../utils/dailyOpsDashboardMetrics'
import type { DailyOpsRevenueBreakdownDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueBreakdownDto> => {
  setResponseHeader(event, 'Cache-Control', 'private, max-age=30, stale-while-revalidate=120')
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()

  const [cat, tp, hourRows, revenueByDate, laborByDate] = await Promise.all([
    fetchRevenueByCategoryFromRaw(db, ctx),
    fetchRevenueByTimePeriod(db, ctx),
    fetchHourlyRevenueForRange(db, ctx),
    fetchRevenueByDate(db, ctx),
    fetchLaborByDate(db, ctx),
  ])

  const best = computeMostProfitableHour(hourRows, revenueByDate, laborByDate)

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
    mostProfitableHour: {
      hourLabel: best.hourLabel,
      date: best.date,
      revenue: Math.round(best.revenue * 100) / 100,
      laborCost: Math.round(best.laborCost * 100) / 100,
      profit: Math.round(best.profit * 100) / 100,
    },
  }
})
