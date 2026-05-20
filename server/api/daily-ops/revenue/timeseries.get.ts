import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchRevenueTimeseries } from '../../../utils/dailyOpsRevenue/fetchRevenueTimeseries'
import type { DailyOpsRevenueTimeseriesDto } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueTimeseriesDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseRevenueQuery(q)
  const gran = q.granularity === 'week' || q.granularity === 'month' || q.granularity === 'quarter' ? q.granularity : 'day'
  const db = await getDb()
  return fetchRevenueTimeseries(db, ctx, gran)
})
