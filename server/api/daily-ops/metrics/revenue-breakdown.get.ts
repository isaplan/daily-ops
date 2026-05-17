import { getDb } from '../../../utils/db'
import {
  buildDailyOpsRevenueBreakdownDto,
  fetchBorkHourAggregatesBundle,
  fetchLaborMetricsPipelineInput,
  fetchRevenueByCategoryFromHourAggregates,
  fetchTodayDashboardRevenueExtras,
  parseDailyOpsMetricsQuery,
} from '../../../utils/dailyOpsDashboardMetrics'
import { fetchLaborCostByBusinessDateHour } from '../../../utils/eitjeLaborByHour'
import { buildDailyOpsProfitByIntervalDto } from '../../../utils/dailyOpsProfitIntervals'
import type { DailyOpsRevenueBreakdownDto } from '~/types/daily-ops-dashboard'

/** Same revenue breakdown as bundle.get (revenue slice only). */
export default defineEventHandler(async (event): Promise<DailyOpsRevenueBreakdownDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()

  const [cat, hourBundle, laborInput, laborByDateHour] = await Promise.all([
    fetchRevenueByCategoryFromHourAggregates(db, ctx),
    fetchBorkHourAggregatesBundle(db, ctx),
    fetchLaborMetricsPipelineInput(db, ctx),
    fetchLaborCostByBusinessDateHour(db, ctx),
  ])

  const [todayExtras, profitByInterval] = await Promise.all([
    fetchTodayDashboardRevenueExtras(db, ctx, hourBundle),
    buildDailyOpsProfitByIntervalDto(db, ctx, cat),
  ])

  return buildDailyOpsRevenueBreakdownDto(
    ctx,
    cat,
    hourBundle,
    laborInput.revMap,
    laborInput.labMap,
    laborByDateHour,
    profitByInterval,
    todayExtras
  )
})
