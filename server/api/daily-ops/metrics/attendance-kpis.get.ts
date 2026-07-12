/**
 * @registry-id: dailyOpsAttendanceKpisGet
 * @created: 2026-05-26T00:43:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: GET /api/daily-ops/metrics/attendance-kpis — lazy planned/leave/sick KPI drawer data.
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=dashboard-bundle · levels=daily|weekly|monthly|yearly · Status: reserved
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { fetchDailyOpsAttendanceKpis } from '../../../utils/dailyOpsAttendanceKpis'
import type { DailyOpsAttendanceKpisDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(async (event): Promise<DailyOpsAttendanceKpisDto> => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const db = await getDb()
  return fetchDailyOpsAttendanceKpis(db, ctx)
})
