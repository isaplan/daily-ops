import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { resolveBorkAggReadSuffix } from '../borkAggVersionSuffix'
import type {
  DailyOpsRevenueCategoryDto,
  DailyOpsRevenueProductRow,
  DailyOpsRevenueQueryContext,
} from '~/types/daily-ops-revenue'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function fetchCategories(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsRevenueCategoryDto[]> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId

  const snaps = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection).find(filter).toArray()
  const map = new Map<string, { revenue: number; itemsCount: number }>()
  for (const s of snaps) {
    const cats = (s as { categories?: Array<{ name: string; revenue_ex_vat: number; quantity: number }> })
      .categories ?? []
    for (const c of cats) {
      const cur = map.get(c.name) ?? { revenue: 0, itemsCount: 0 }
      cur.revenue += c.revenue_ex_vat
      cur.itemsCount += c.quantity
      map.set(c.name, cur)
    }
  }
  const total = [...map.values()].reduce((a, b) => a + b.revenue, 0)
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      revenue: round2(v.revenue),
      itemsCount: v.itemsCount,
      pctOfTotal: total > 0 ? round2((v.revenue / total) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function fetchTopProducts(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
  limit = 20,
): Promise<DailyOpsRevenueProductRow[]> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId

  const snaps = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection).find(filter).toArray()
  const map = new Map<string, { revenue: number; itemsCount: number }>()
  for (const s of snaps) {
    const products = (s as { products?: Array<{ productName: string; revenue_ex_vat: number; quantity: number }> })
      .products ?? []
    for (const p of products) {
      const cur = map.get(p.productName) ?? { revenue: 0, itemsCount: 0 }
      cur.revenue += p.revenue_ex_vat
      cur.itemsCount += p.quantity
      map.set(p.productName, cur)
    }
  }
  const base = [...map.entries()]
    .map(([productName, v]) => ({
      productName,
      revenue: round2(v.revenue),
      itemsCount: v.itemsCount,
      revenuePerItem: v.itemsCount > 0 ? round2(v.revenue / v.itemsCount) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)

  const byWeekday = await fetchProductWeekdayDistribution(db, ctx, base.map((p) => p.productName))
  return base.map((p) => ({
    ...p,
    byWeekday: byWeekday.get(p.productName),
  }))
}

const DOW_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const WEEKDAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

async function fetchProductWeekdayDistribution(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
  productNames: string[],
): Promise<Map<string, Array<{ dayOfWeek: string; itemsCount: number; revenue: number }>>> {
  const out = new Map<string, Array<{ dayOfWeek: string; itemsCount: number; revenue: number }>>()
  if (productNames.length === 0) return out

  const suffix = resolveBorkAggReadSuffix()
  const coll = `bork_sales_by_product${suffix}`
  const match: Record<string, unknown> = {
    business_date: { $gte: ctx.startDate, $lte: ctx.endDate },
    productName: { $in: productNames },
  }
  if (ctx.locationId && ObjectId.isValid(ctx.locationId)) {
    match.locationId = new ObjectId(ctx.locationId)
  }

  const rows = await db
    .collection(coll)
    .find(match)
    .project({ productName: 1, business_date: 1, total_quantity: 1, total_revenue_ex_vat: 1, total_revenue: 1 })
    .toArray()

  const acc = new Map<string, Map<string, { itemsCount: number; revenue: number }>>()
  for (const r of rows) {
    const doc = r as Record<string, unknown>
    const name = String(doc.productName ?? '')
    const date = String(doc.business_date ?? '')
    if (!name || !date) continue
    const dow = DOW_KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()]!
    const rev = Number(doc.total_revenue_ex_vat ?? doc.total_revenue ?? 0)
    const qty = Number(doc.total_quantity ?? 0)
    if (!acc.has(name)) acc.set(name, new Map())
    const m = acc.get(name)!
    const cur = m.get(dow) ?? { itemsCount: 0, revenue: 0 }
    cur.itemsCount += qty
    cur.revenue += rev
    m.set(dow, cur)
  }

  for (const [name, m] of acc) {
    out.set(
      name,
      WEEKDAY_ORDER.map((dayOfWeek) => {
        const v = m.get(dayOfWeek) ?? { itemsCount: 0, revenue: 0 }
        return {
          dayOfWeek,
          itemsCount: v.itemsCount,
          revenue: round2(v.revenue),
        }
      }),
    )
  }
  return out
}
