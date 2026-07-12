/**
 * @registry-id: dailyOpsStaffRollingMediansGet
 * @created: 2026-06-25T12:00:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Staff rolling median KPIs — read-cache staff-timeseries slice (ADR-013)
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=staff-timeseries · levels=daily|weekly|monthly|yearly
 *
 * @imports-from:
 *   - server/utils/dailyOpsStaff/computeStaffRollingMedians.ts
 */

import { getDb } from '../../../utils/db'
import { parseStaffAnalyticsQuery } from '../../../utils/dailyOpsStaff/parseStaffAnalyticsQuery'
import { computeStaffRollingMedians } from '../../../utils/dailyOpsStaff/computeStaffRollingMedians'
import type { DailyOpsStaffRollingMediansDto } from '~/types/daily-ops-staff'

export default defineEventHandler(async (event): Promise<DailyOpsStaffRollingMediansDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseStaffAnalyticsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  return computeStaffRollingMedians(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId,
    chartGranularity: ctx.chartGranularity,
  })
})
