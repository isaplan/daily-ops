import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchOrderPaymentRhythm } from '../../../utils/dailyOpsRevenue/fetchOrderPaymentRhythm'
import type { DailyOpsOrderPaymentRhythmPoint } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsOrderPaymentRhythmPoint[]> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseRevenueQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  return fetchOrderPaymentRhythm(db, ctx)
})
