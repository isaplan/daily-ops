import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchTableRevenue } from '../../../utils/dailyOpsRevenue/fetchStaffAndTables'
import type { DailyOpsRevenueTableRow } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueTableRow[]> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseRevenueQuery(q)
  const space = typeof q.space === 'string' ? q.space : undefined
  const db = await getDb()
  return fetchTableRevenue(db, ctx, space)
})
