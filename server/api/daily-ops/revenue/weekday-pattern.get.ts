import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { computeWeekdayPattern } from '../../../utils/dailyOpsRevenue/computeWeekdayPattern'
import type { DailyOpsWeekdayPatternRow } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsWeekdayPatternRow[]> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseRevenueQuery(q)
  const weekday = typeof q.weekday === 'string' ? q.weekday : 'monday'
  const db = await getDb()
  return computeWeekdayPattern(db, weekday, ctx.endDate, ctx.locationId, ctx.compareEndDate)
})
