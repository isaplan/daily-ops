import type { Db } from 'mongodb'
import type { DailyOpsRevenueQueryContext, DailyOpsRevenueTimeseriesDto } from '~/types/daily-ops-revenue'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import { eachBusinessDate } from './dateRange'
import { fetchRevenueRangeForDates } from './fetchRevenueRange'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function fetchRevenueTimeseries(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
  granularity: 'day' | 'week' | 'month' | 'quarter' = 'day',
): Promise<DailyOpsRevenueTimeseriesDto> {
  const current: DailyOpsRevenueTimeseriesDto['current'] = []

  if (granularity === 'day') {
    for (const date of eachBusinessDate(ctx.startDate, ctx.endDate)) {
      const filter: Record<string, unknown> = { businessDate: date }
      if (ctx.locationId) filter.locationId = ctx.locationId
      const snap = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection).findOne(filter)
      if (snap?.totals) {
        const t = snap.totals as { ex_vat: number; quantity: number }
        current.push({ date, revenue: round2(t.ex_vat), itemsCount: t.quantity })
      } else {
        const t = await fetchRevenueRangeForDates(db, date, date, ctx.locationId)
        current.push({ date, revenue: round2(t.revenue), itemsCount: t.itemsCount })
      }
    }
  } else {
    const t = await fetchRevenueRangeForDates(db, ctx.startDate, ctx.endDate, ctx.locationId)
    current.push({ date: ctx.startDate, revenue: round2(t.revenue), itemsCount: t.itemsCount })
  }

  let compare: DailyOpsRevenueTimeseriesDto['compare']
  if (ctx.compareStartDate && ctx.compareEndDate) {
    compare = []
    for (const date of eachBusinessDate(ctx.compareStartDate, ctx.compareEndDate)) {
      const t = await fetchRevenueRangeForDates(db, date, date, ctx.locationId)
      compare.push({ date, revenue: round2(t.revenue), itemsCount: t.itemsCount })
    }
  }

  return {
    granularity,
    current,
    compare,
    compareLabel: ctx.compareLabel,
  }
}
