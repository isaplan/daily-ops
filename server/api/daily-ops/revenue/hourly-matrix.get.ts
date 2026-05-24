import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchHourlyMatrix } from '../../../utils/dailyOpsRevenue/fetchHourlyMatrix'
import type { DailyOpsRevenueHourlyMatrixDto } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueHourlyMatrixDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseRevenueQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  return fetchHourlyMatrix(db, ctx)
})
