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
