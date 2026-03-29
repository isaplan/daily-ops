import { resolveDailyOpsPeriod } from '../../utils/dailyOpsPeriod'
import type { DailyOpsOverviewDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler((event): DailyOpsOverviewDto => {
  const q = getQuery(event)
  const period = typeof q.period === 'string' ? q.period : 'today'
  const anchor = typeof q.anchor === 'string' ? q.anchor : undefined
  const range = resolveDailyOpsPeriod(period, anchor)

  return {
    range: {
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
    },
    summary: {
      totalRevenue: 0,
      totalLaborCost: 121.3,
      profit: -121.3,
      profitMarginPct: 0,
    },
    revenueByCategory: [
      { key: 'drinks', label: 'Drinks', amount: 0 },
      { key: 'food', label: 'Food', amount: 0 },
    ],
    revenueByTimePeriod: [
      { key: 'lunch', label: 'Lunch', amount: 0 },
      { key: 'pre_drinks', label: 'Pre Drinks', amount: 0 },
      { key: 'dinner', label: 'Dinner', amount: 0 },
      { key: 'after_drinks', label: 'After Drinks', amount: 0 },
    ],
    mostProfitableHour: {
      hourLabel: '0:00',
      revenue: 0,
      laborCost: 0,
      profit: 0,
    },
    vatDisclaimer: 'All revenue values shown are excluding VAT (ex VAT)',
  }
})
