import { getDb } from '../../../utils/db'
import {
  buildDailyOpsSummaryDto,
  fetchLaborByDate,
  fetchRevenueByDate,
  parseDailyOpsMetricsQuery,
} from '../../../utils/dailyOpsDashboardMetrics'
import type { DailyOpsSummaryDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(async (event): Promise<DailyOpsSummaryDto> => {
  setResponseHeader(event, 'Cache-Control', 'private, max-age=30, stale-while-revalidate=120')
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  const [revMap, labMap] = await Promise.all([fetchRevenueByDate(db, ctx), fetchLaborByDate(db, ctx)])
  return buildDailyOpsSummaryDto(ctx, revMap, labMap)
})
