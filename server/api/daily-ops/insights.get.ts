import { getDb } from '../../utils/db'
import { buildPerformanceInsights } from '../../utils/dailyOpsInsights/buildPerformanceInsights'
import { parseInsightsQuery } from '../../utils/dailyOpsInsights/parseInsightsQuery'
import type { DailyOpsPerformanceInsightsDto } from '~/types/daily-ops-insights'

export default defineEventHandler(async (event): Promise<DailyOpsPerformanceInsightsDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseInsightsQuery(q)
  const db = await getDb()
  return buildPerformanceInsights(db, ctx)
})
