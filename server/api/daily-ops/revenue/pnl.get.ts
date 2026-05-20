import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { parsePnlAssumptions } from '../../../utils/dailyOpsRevenue/pnlAssumptions'
import { computeSimplePnL } from '../../../utils/dailyOpsRevenue/computeSimplePnL'
import type { DailyOpsSimplePnLDto } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsSimplePnLDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseRevenueQuery(q)
  const assumptions = parsePnlAssumptions(q)
  const db = await getDb()
  return computeSimplePnL(db, ctx, assumptions)
})
