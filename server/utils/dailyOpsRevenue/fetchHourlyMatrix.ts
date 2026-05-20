import type { Db } from 'mongodb'
import type { DailyOpsRevenueHourlyMatrixDto, DailyOpsRevenueQueryContext } from '~/types/daily-ops-revenue'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import { eachBusinessDate } from './dateRange'

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]

function emptyCell() {
  return { revenue: 0, itemsCount: 0, foodRevenue: 0, drinksRevenue: 0 }
}

export async function fetchHourlyMatrix(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsRevenueHourlyMatrixDto> {
  const accum = Array.from({ length: 24 }, () =>
    DOW_ORDER.map(() => emptyCell()),
  )

  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId

  const snaps = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueHourlySection).find(filter).toArray()

  for (const snap of snaps) {
    const businessDate = String(snap.businessDate)
    const dow = new Date(`${businessDate}T12:00:00Z`).getUTCDay()
    const col = DOW_ORDER.indexOf(dow)
    if (col < 0) continue
    const hourly = (snap as { hourly?: Array<{ business_hour: number; revenue: { ex_vat: number }; quantity: number }> })
      .hourly
    if (!hourly) continue
    for (const h of hourly) {
      const hour = Number(h.business_hour)
      if (hour < 0 || hour > 23) continue
      const cell = accum[hour]![col]!
      const rev = Number(h.revenue?.ex_vat ?? 0)
      cell.revenue += rev
      cell.itemsCount += Number(h.quantity ?? 0)
    }
  }

  if (snaps.length === 0) {
    for (const date of eachBusinessDate(ctx.startDate, ctx.endDate)) {
      const dayFilter = { ...filter, businessDate: date }
      const revSnap = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection).findOne(dayFilter)
      const hourly = (revSnap as { hourly?: Array<{ business_hour: number; revenue: { ex_vat: number }; quantity: number }> })
        ?.hourly
      if (!hourly) continue
      const dow = new Date(`${date}T12:00:00Z`).getUTCDay()
      const col = DOW_ORDER.indexOf(dow)
      if (col < 0) continue
      for (const h of hourly) {
        const hour = Number(h.business_hour)
        if (hour < 0 || hour > 23) continue
        const cell = accum[hour]![col]!
        cell.revenue += Number(h.revenue?.ex_vat ?? 0)
        cell.itemsCount += Number(h.quantity ?? 0)
      }
    }
  }

  const rows = accum.map((weekdays, hour) => ({
    hour,
    weekdays: weekdays.map((c) => ({
      revenue: Math.round(c.revenue * 100) / 100,
      itemsCount: c.itemsCount,
      foodRevenue: Math.round(c.foodRevenue * 100) / 100,
      drinksRevenue: Math.round(c.drinksRevenue * 100) / 100,
    })),
  }))

  return { rows }
}
