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
