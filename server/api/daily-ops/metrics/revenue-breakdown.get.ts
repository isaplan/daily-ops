import { getDb } from '../../../utils/db'
import {
  buildDailyOpsRevenueBreakdownDto,
  fetchBorkHourAggregatesBundle,
  fetchLaborByDate,
  fetchRevenueByCategoryFromHourAggregates,
  fetchRevenueByDate,
  parseDailyOpsMetricsQuery,
} from '../../../utils/dailyOpsDashboardMetrics'
import type { DailyOpsRevenueBreakdownDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueBreakdownDto> => {
  setResponseHeader(event, 'Cache-Control', 'private, max-age=30, stale-while-revalidate=120')
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()

  const [cat, hourBundle, revenueByDate, laborByDate] = await Promise.all([
    fetchRevenueByCategoryFromHourAggregates(db, ctx),
    fetchBorkHourAggregatesBundle(db, ctx),
    fetchRevenueByDate(db, ctx),
    fetchLaborByDate(db, ctx),
  ])

  return buildDailyOpsRevenueBreakdownDto(ctx, cat, hourBundle, revenueByDate, laborByDate)
})
