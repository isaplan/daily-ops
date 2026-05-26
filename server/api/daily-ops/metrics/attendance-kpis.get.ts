/**
 * @registry-id: dailyOpsAttendanceKpisGet
 * @created: 2026-05-26T00:43:00.000Z
 * @last-modified: 2026-05-26T00:43:00.000Z
 * @description: GET /api/daily-ops/metrics/attendance-kpis — lazy planned/leave/sick KPI drawer data.
 * @last-fix: [2026-05-26] Initial lazy drawer endpoint.
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsDashboardMetrics'
import { fetchDailyOpsAttendanceKpis } from '../../../utils/dailyOpsAttendanceKpis'
import type { DailyOpsAttendanceKpisDto } from '~/types/daily-ops-dashboard'

export default defineEventHandler(async (event): Promise<DailyOpsAttendanceKpisDto> => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (ctx.startDate !== ctx.endDate) {
    throw createError({
      statusCode: 400,
      message: 'Attendance KPI drawers require a single business day.',
    })
  }

  const db = await getDb()
  return fetchDailyOpsAttendanceKpis(db, ctx)
})
