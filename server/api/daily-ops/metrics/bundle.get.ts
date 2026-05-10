import { getDb } from '../../../utils/db'
import {
  assembleDailyOpsLaborMetricsDto,
  buildDailyOpsRevenueBreakdownDto,
  buildDailyOpsSummaryDto,
  fetchBorkHourAggregatesBundle,
  fetchInboxBasisRevenueTotalExVat,
  fetchLaborMetricsPipelineInput,
  fetchRevenueByCategoryFromHourAggregates,
  fetchTodayDashboardRevenueExtras,
  parseDailyOpsMetricsQuery,
} from '../../../utils/dailyOpsDashboardMetrics'
import type {
  DailyOpsLaborMetricsDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
} from '~/types/daily-ops-dashboard'

type DailyOpsDashboardBundleDto = {
  summary: DailyOpsSummaryDto
  revenue: DailyOpsRevenueBreakdownDto
  labor: DailyOpsLaborMetricsDto
}

export default defineEventHandler(async (event): Promise<DailyOpsDashboardBundleDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()

  const [cat, hourBundle, laborInput, inboxBasisExVat] = await Promise.all([
    fetchRevenueByCategoryFromHourAggregates(db, ctx),
    fetchBorkHourAggregatesBundle(db, ctx),
    fetchLaborMetricsPipelineInput(db, ctx),
    fetchInboxBasisRevenueTotalExVat(db, ctx),
  ])

  const todayExtras = await fetchTodayDashboardRevenueExtras(db, ctx, hourBundle)

  const summary = buildDailyOpsSummaryDto(ctx, laborInput.revMap, laborInput.labMap, {
    apiBusinessDaysTotal: laborInput.revenueSplit.businessDaysPeriodTotal,
    inboxBasisExVat,
  })
  const revenue = buildDailyOpsRevenueBreakdownDto(ctx, cat, hourBundle, laborInput.revMap, laborInput.labMap, todayExtras)
  const labor = assembleDailyOpsLaborMetricsDto(ctx, laborInput)

  return { summary, revenue, labor }
})
