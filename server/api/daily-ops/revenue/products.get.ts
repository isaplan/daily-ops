import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchTopProducts } from '../../../utils/dailyOpsRevenue/fetchCategoriesAndProducts'
import type { DailyOpsRevenueProductRow } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueProductRow[]> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseRevenueQuery(q)
  const limit = Number(q.limit) > 0 ? Number(q.limit) : 20
  const db = await getDb()
  return fetchTopProducts(db, ctx, limit)
})
