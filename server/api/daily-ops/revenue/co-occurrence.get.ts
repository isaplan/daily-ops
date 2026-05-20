import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchCoOccurrence } from '../../../utils/dailyOpsRevenue/fetchCoOccurrence'
import type { DailyOpsRevenueCoOccurrenceDto } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueCoOccurrenceDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseRevenueQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  return fetchCoOccurrence(db, ctx)
})
