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
import { fetchLaborCostByBusinessDateHour } from '../../../utils/eitjeLaborByHour'
import { aggregateLaborForRange } from '../../../utils/dailyOpsSnapshot/aggregateLaborForRange'
import { buildDailyOpsProfitByIntervalDto } from '../../../utils/dailyOpsProfitIntervals'
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

  const [cat, hourBundle, laborInput, laborByDateHour, inboxBasisExVat, laborBreakdown] =
    await Promise.all([
    fetchRevenueByCategoryFromHourAggregates(db, ctx),
    fetchBorkHourAggregatesBundle(db, ctx),
    fetchLaborMetricsPipelineInput(db, ctx),
    fetchLaborCostByBusinessDateHour(db, ctx),
    fetchInboxBasisRevenueTotalExVat(db, ctx),
    aggregateLaborForRange(db, {
      startDate: ctx.startDate,
      endDate: ctx.endDate,
      locationId: ctx.locationId,
    }),
  ])

  const [todayExtras, profitByInterval] = await Promise.all([
    fetchTodayDashboardRevenueExtras(db, ctx, hourBundle),
    buildDailyOpsProfitByIntervalDto(db, ctx, cat),
  ])

  const summary = buildDailyOpsSummaryDto(ctx, laborInput.revMap, laborInput.labMap, {
    apiBusinessDaysTotal: laborInput.revenueSplit.businessDaysPeriodTotal,
    inboxBasisExVat,
  })
  if (laborBreakdown.coverage.daysFound > 0) {
    summary.summary.laborBreakdown = laborBreakdown
  }
  const revenue = buildDailyOpsRevenueBreakdownDto(
    ctx,
    cat,
    hourBundle,
    laborInput.revMap,
    laborInput.labMap,
    laborByDateHour,
    profitByInterval,
    todayExtras
  )
  const labor = assembleDailyOpsLaborMetricsDto(ctx, laborInput)

  return { summary, revenue, labor }
})
