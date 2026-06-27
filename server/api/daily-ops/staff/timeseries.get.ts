import { getDb } from '../../../utils/db'
import { parseStaffAnalyticsQuery } from '../../../utils/dailyOpsStaff/parseStaffAnalyticsQuery'
import { fetchStaffTimeseries } from '../../../utils/dailyOpsStaff/fetchStaffTimeseries'
import type { DailyOpsStaffTimeseriesDto } from '~/types/daily-ops-staff'

export default defineEventHandler(async (event): Promise<DailyOpsStaffTimeseriesDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseStaffAnalyticsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  return fetchStaffTimeseries(db, ctx, ctx.chartGranularity)
})
