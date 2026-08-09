/**
 * @registry-id: dailyOpsAttendanceKpisGet
 * @created: 2026-05-26T00:43:00.000Z
 * @last-modified: 2026-08-09T01:00:00.000Z
 * @description: GET /api/daily-ops/metrics/attendance-kpis — period-cache staff.workers
 * @last-fix: [2026-08-09] Period-cache only (no live Eitje on GET)
 * @adr-ref: ADR-004, ADR-010, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache · level=day · staff.workers
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { resolveAttendanceFromPeriodCache } from '../../../utils/dailyOpsPeriodCache/resolveAttendanceFromPeriodCache'
import type { DailyOpsAttendanceKpisDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(async (event): Promise<DailyOpsAttendanceKpisDto> => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const db = await getDb()
  return resolveAttendanceFromPeriodCache(db, ctx)
})
