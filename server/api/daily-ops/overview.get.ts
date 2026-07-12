/**
 * @registry-id: dailyOpsOverviewGet
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: @deprecated — use /metrics/bundle; snapshot bundle read (ADR-004)
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=dashboard-bundle · levels=daily|weekly|monthly|yearly
 */
import { getDb } from '../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../utils/dailyOpsMetrics/context'
import { VAT_DISCLAIMER } from '../../utils/dailyOpsMetrics/dtoBuilders'
import { fetchDailyOpsDashboardBundle } from '../../utils/dailyOpsSnapshot/fetchDashboardBundle'
import type { DailyOpsOverviewDto } from '~/types/daily-ops-dashboard'

/** @deprecated Removed ADR-004 — use /api/daily-ops/metrics/bundle instead. */
export default defineEventHandler(async (event): Promise<DailyOpsOverviewDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'Deprecation', 'true')
  setResponseHeader(event, 'Link', '</api/daily-ops/metrics/bundle>; rel="successor-version"')

  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  const bundle = await fetchDailyOpsDashboardBundle(db, ctx)
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
