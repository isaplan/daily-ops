import { getDb } from '../../../utils/db'
import {
  VAT_DISCLAIMER,
  fetchBorkRevenueTotals,
  fetchEitjeLaborTotals,
  parseDailyOpsMetricsQuery,
} from '../../../utils/dailyOpsDashboardMetrics'
import type { DailyOpsSummaryDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(async (event): Promise<DailyOpsSummaryDto> => {
  setResponseHeader(event, 'Cache-Control', 'private, max-age=30, stale-while-revalidate=120')
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  const [rev, lab] = await Promise.all([fetchBorkRevenueTotals(db, ctx), fetchEitjeLaborTotals(db, ctx)])

  const totalRevenue = rev.totalRevenue
  const totalLaborCost = lab.totalLaborCost
  const totalLaborHours = lab.totalHours
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
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalLaborCost: Math.round(totalLaborCost * 100) / 100,
      totalLaborHours: Math.round(totalLaborHours * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitMarginPct: Math.round(profitMarginPct * 10) / 10,
      revenuePerLaborHour:
        revenuePerLaborHour != null ? Math.round(revenuePerLaborHour * 100) / 100 : null,
      laborCostPctOfRevenue:
        laborCostPctOfRevenue != null ? Math.round(laborCostPctOfRevenue * 10) / 10 : null,
    },
    vatDisclaimer: VAT_DISCLAIMER,
  }
})
