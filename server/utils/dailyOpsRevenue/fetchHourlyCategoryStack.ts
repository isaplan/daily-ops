import type { Db } from 'mongodb'
import type {
  DailyOpsRevenueHourlyCategoryStackDto,
  DailyOpsRevenueQueryContext,
} from '~/types/daily-ops-revenue'
import { fetchHourlyMatrix } from './fetchHourlyMatrix'
import { fetchRevenueRange } from './fetchRevenueRange'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Hourly keuken vs dranken — period food/bev ratio applied per hour total. */
export async function fetchHourlyCategoryStack(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsRevenueHourlyCategoryStackDto> {
  const [matrix, totals] = await Promise.all([
    fetchHourlyMatrix(db, ctx),
    fetchRevenueRange(db, ctx),
  ])
  const foodShare =
    totals.revenue > 0 ? totals.foodRevenue / totals.revenue : 0.7
  const bevShare =
    totals.revenue > 0 ? totals.beverageRevenue / totals.revenue : 0.3

  const points = matrix.rows.map((row) => {
    const hourRev = row.weekdays.reduce((s, c) => s + c.revenue, 0)
    return {
      hour: row.hour,
      keuken: round2(hourRev * foodShare),
      dranken: round2(hourRev * bevShare),
    }
  })
  return { points }
}
