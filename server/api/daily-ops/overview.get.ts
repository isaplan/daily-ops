/**
 * @registry-id: dailyOpsOverviewGet
 * @last-modified: 2026-08-09T17:25:00.000Z
 * @description: @deprecated — use /metrics/bundle; Today live / sealed period-cache
 * @last-fix: [2026-08-09] Today live exception via loadDashboardBundleForGet
 * @adr-ref: ADR-004, ADR-010, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: snapshot-today-live | period-cache
 * @read-cache-json: daily_ops_period_cache · level=day (sealed)
 */
import { getDb } from '../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../utils/dailyOpsMetrics/context'
import { VAT_DISCLAIMER } from '../../utils/dailyOpsMetrics/dtoBuilders'
import { loadDashboardBundleForGet } from '../../utils/dailyOpsSnapshot/loadDashboardBundleForGet'
import type { DailyOpsOverviewDto } from '~/types/daily-ops-dashboard'

/** @deprecated Removed ADR-004 — use /api/daily-ops/metrics/bundle instead. */
export default defineEventHandler(async (event): Promise<DailyOpsOverviewDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'Deprecation', 'true')
  setResponseHeader(event, 'Link', '</api/daily-ops/metrics/bundle>; rel="successor-version"')

  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  const bundle = await loadDashboardBundleForGet(db, ctx)
  const { summary, revenue } = bundle

  const revenueByCategory = revenue.revenueByCategory.map((c) => ({
    key: c.key,
    label: c.label,
    amount: c.amount,
  }))
  const revenueByTimePeriod = revenue.revenueByTimePeriod.map((c) => ({
    key: c.key,
    label: c.label,
    amount: c.amount,
  }))

  const best = revenue.mostProfitableHour

  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    summary: {
      totalRevenue: summary.summary.totalRevenue,
      totalLaborCost: summary.summary.totalLaborCost,
      profit: summary.summary.profit,
      profitMarginPct: summary.summary.profitMarginPct,
    },
    revenueByCategory,
    revenueByTimePeriod,
    mostProfitableHour: {
      hourLabel: best.hourLabel,
      date: best.date,
      revenue: best.revenue,
      laborCost: best.laborCost,
      profit: best.profit,
    },
    vatDisclaimer: VAT_DISCLAIMER,
  }
})
