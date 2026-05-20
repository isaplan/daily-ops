import type { Db } from 'mongodb'
import type {
  DailyOpsRevenueQueryContext,
  DailyOpsRevenueStaffRow,
  DailyOpsRevenueTableRow,
} from '~/types/daily-ops-revenue'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import { LOCATION_SPACE_LABELS, type LocationSpaceId } from './locationSpaces'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function fetchStaffRevenue(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsRevenueStaffRow[]> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId

  const snaps = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueWorkersSection).find(filter).toArray()
  const map = new Map<string, { revenue: number; orderCount: number; quantity: number }>()
  for (const s of snaps) {
    const workers =
      (s as {
        workers?: Array<{
          workerName: string
          revenue_ex_vat: number
          order_count: number
          quantity: number
        }>
      }).workers ?? []
    for (const w of workers) {
      const cur = map.get(w.workerName) ?? { revenue: 0, orderCount: 0, quantity: 0 }
      cur.revenue += w.revenue_ex_vat
      cur.orderCount += w.order_count
      cur.quantity += w.quantity
      map.set(w.workerName, cur)
    }
  }
  return [...map.entries()]
    .map(([staffName, v]) => ({
      staffName,
      revenue: round2(v.revenue),
      orderCount: v.orderCount,
      avgProductsPerOrder: v.orderCount > 0 ? round2(v.quantity / v.orderCount) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function fetchTableRevenue(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
  spaceFilter?: string,
): Promise<DailyOpsRevenueTableRow[]> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId

  const snaps = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueTablesSection).find(filter).toArray()
  const map = new Map<string, { revenue: number; itemsCount: number; locationSpace: string }>()
  for (const s of snaps) {
    const tables =
      (s as {
        tables?: Array<{
          tableNum: string
          locationSpace: string
          revenue_ex_vat: number
          quantity: number
        }>
      }).tables ?? []
    for (const t of tables) {
      if (spaceFilter && t.locationSpace !== spaceFilter) continue
      const cur = map.get(t.tableNum) ?? { revenue: 0, itemsCount: 0, locationSpace: t.locationSpace }
      cur.revenue += t.revenue_ex_vat
      cur.itemsCount += t.quantity
      map.set(t.tableNum, cur)
    }
  }
  return [...map.entries()]
    .map(([tableNum, v]) => ({
      tableNum,
      locationSpace: LOCATION_SPACE_LABELS[v.locationSpace as LocationSpaceId] ?? v.locationSpace,
      revenue: round2(v.revenue),
      itemsCount: v.itemsCount,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function fetchLocationSpaceSplit(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<Array<{ space: string; revenue: number; itemsCount: number; revenuePerItem: number }>> {
  const tables = await fetchTableRevenue(db, ctx, ctx.locationSpace)
  const map = new Map<string, { revenue: number; itemsCount: number }>()
  for (const t of tables) {
    const key = t.locationSpace
    const cur = map.get(key) ?? { revenue: 0, itemsCount: 0 }
    cur.revenue += t.revenue
    cur.itemsCount += t.itemsCount
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([space, v]) => ({
      space,
      revenue: round2(v.revenue),
      itemsCount: v.itemsCount,
      revenuePerItem: v.itemsCount > 0 ? round2(v.revenue / v.itemsCount) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}
