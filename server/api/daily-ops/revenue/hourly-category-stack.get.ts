/**
 * @registry-id: dailyOpsRevenueHourlyCategoryStackGet
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Hourly category stack — read-cache target (ADR-013, reserved)
 * @last-fix: [2026-07-02] ADR-013 reserved read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache (reserved - page not built yet)
 * @read-cache-json: daily_ops_read_cache · profile=revenue-hourly-category-stack · levels=daily
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenueMetrics.ts
 */

import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchHourlyCategoryStack } from '../../../utils/dailyOpsRevenue/fetchHourlyCategoryStack'
import type { DailyOpsRevenueHourlyCategoryStackDto } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueHourlyCategoryStackDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseRevenueQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  return fetchHourlyCategoryStack(db, ctx)
})
