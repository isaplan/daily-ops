import { getDb } from '../../../utils/db'
import { parseRevenueQuery } from '../../../utils/dailyOpsRevenue/parseRevenueQuery'
import { fetchRevenueRange } from '../../../utils/dailyOpsRevenue/fetchRevenueRange'
import type { DailyOpsRevenueKpiDto } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<DailyOpsRevenueKpiDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const ctx = parseRevenueQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  const totals = await fetchRevenueRange(db, ctx)
  const revenuePerItem = totals.itemsCount > 0 ? totals.revenue / totals.itemsCount : 0

  const dto: DailyOpsRevenueKpiDto = {
    revenue: Math.round(totals.revenue * 100) / 100,
    itemsCount: totals.itemsCount,
    revenuePerItem: Math.round(revenuePerItem * 100) / 100,
    leadSource: totals.leadSource,
    currentLabel: ctx.label,
    compareLabel: ctx.compareLabel,
  }

  if (ctx.compareStartDate && ctx.compareEndDate) {
    const cmp = await fetchRevenueRange(db, {
      ...ctx,
      startDate: ctx.compareStartDate,
      endDate: ctx.compareEndDate,
    })
    dto.compareDelta = {
      amount: Math.round((totals.revenue - cmp.revenue) * 100) / 100,
      pct: cmp.revenue > 0 ? Math.round(((totals.revenue - cmp.revenue) / cmp.revenue) * 10000) / 100 : null,
    }
  }

  return dto
})
