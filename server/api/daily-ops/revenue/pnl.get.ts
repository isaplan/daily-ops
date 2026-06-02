import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { computeSimplePnL } from '../../../utils/dailyOpsRevenue/computeSimplePnL'
import { loadPnlAssumptions } from '../../../utils/appSettings/pnlAssumptionsSetting'
import type { DailyOpsSimplePnLDto } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsSimplePnLDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const ctx = parseRevenueQuery(q)
  const db = await getDb()
  const assumptions = await loadPnlAssumptions(db)
  return computeSimplePnL(db, ctx, assumptions)
})
