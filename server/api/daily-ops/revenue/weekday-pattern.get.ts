/**
 * @registry-id: dailyOpsRevenueWeekdayPatternGet
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Weekday revenue pattern — read-cache target (ADR-013, reserved)
 * @last-fix: [2026-07-02] ADR-013 reserved read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache (reserved - page not built yet)
 * @read-cache-json: daily_ops_read_cache · profile=revenue-weekday-pattern · levels=daily
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenueMetrics.ts
 */

import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { computeWeekdayPattern } from '../../../utils/dailyOpsRevenue/computeWeekdayPattern'
import type { DailyOpsWeekdayPatternRow } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsWeekdayPatternRow[]> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseRevenueQuery(q)
  const weekday = typeof q.weekday === 'string' ? q.weekday : 'monday'
  const db = await getDb()
  return computeWeekdayPattern(db, weekday, ctx.endDate, ctx.locationId, ctx.compareEndDate)
})
