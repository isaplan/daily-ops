import { getDb } from '../../../utils/db'
import {
  buildDailyOpsSummaryDto,
  fetchLaborByDate,
  fetchRevenueByDate,
  parseDailyOpsMetricsQuery,
} from '../../../utils/dailyOpsDashboardMetrics'
import type { DailyOpsSummaryDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(async (event): Promise<DailyOpsSummaryDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  const [revMap, labMap] = await Promise.all([fetchRevenueByDate(db, ctx), fetchLaborByDate(db, ctx)])
  return buildDailyOpsSummaryDto(ctx, revMap, labMap)
})
