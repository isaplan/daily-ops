/**
 * @registry-id: dailyOpsInsightsGet
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Performance insights — read-cache target (reserved)
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=insights · levels=monthly|yearly · Status: reserved
 *
 * @exports-to:
 * ✓ composables/useDailyOpsInsightsMetrics.ts
 */
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
