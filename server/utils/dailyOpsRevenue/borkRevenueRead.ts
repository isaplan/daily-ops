/**
 * @registry-id: dailyOpsRevenueBorkRead
 * @last-modified: 2026-05-21T00:00:00.000Z
 * @description: Bork V2 fallbacks when revenue snapshot sections are missing or partial
 * @last-fix: [2026-05-21] Shared Bork reads for categories, products, hourly matrix
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { listBorkAggReadSuffixCandidates, resolveBorkAggReadSuffix } from '../borkAggVersionSuffix'
import { BORK_DOC_REVENUE_EXPR, BORK_DOC_REVENUE_INC_EXPR } from '../dailyOpsMetrics/borkAggregationExprs'
import {
  loadProductCatalogResolver,
  splitLineRevenueByCatalog,
  sumFoodBeverageFromHourAggregates,
} from '../borkFoodBeverageSplit'
import type { DailyOpsRevenueQueryContext } from '~/types/daily-ops-revenue'

export function borkRevenueMatch(
  ctx: Pick<DailyOpsRevenueQueryContext, 'startDate' | 'endDate' | 'locationId'>,
): Record<string, unknown> {
  const q: Record<string, unknown> = {
    business_date: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId && ObjectId.isValid(ctx.locationId)) {
    q.locationId = new ObjectId(ctx.locationId)
  }
  return q
}

function docRevenueEx(doc: Record<string, unknown>): number {
  const ex = Number(doc.total_revenue_ex_vat ?? 0)
  if (ex > 0) return ex
  return Number(doc.total_revenue ?? 0)
}

export type FetchBorkRangeTotalsOpts = {
  /** Skip bork_sales_by_hour $unwind (summary KPI path). */
  skipFoodBev?: boolean
}

export async function fetchBorkRangeTotals(
  db: Db,
  ctx: Pick<DailyOpsRevenueQueryContext, 'startDate' | 'endDate' | 'locationId'>,
  opts?: FetchBorkRangeTotalsOpts,
): Promise<{
  revenue: number
  revenueIncVat: number
  itemsCount: number
  foodRevenue: number
  beverageRevenue: number
}> {
  const match = borkRevenueMatch(ctx)

  let revenue = 0
  let revenueIncVat = 0
  let itemsCount = 0
  for (const suffix of listBorkAggReadSuffixCandidates()) {
    const collName = `bork_business_days${suffix}`
    const exists = await db.listCollections({ name: collName }).hasNext()
    if (!exists) continue

    const [dayRow] = await db
      .collection(collName)
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            revenue: { $sum: BORK_DOC_REVENUE_EXPR },
            revenueIncVat: { $sum: BORK_DOC_REVENUE_INC_EXPR },
            itemsCount: { $sum: { $ifNull: ['$total_quantity', 0] } },
          },
        },
      ])
      .toArray()

    const d = dayRow as { revenue?: number; revenueIncVat?: number; itemsCount?: number } | undefined
    const rev = Number(d?.revenue ?? 0)
    if (rev > 0) {
      revenue = rev
      revenueIncVat = Number(d?.revenueIncVat ?? 0)
      itemsCount = Number(d?.itemsCount ?? 0)
      break
    }
  }

  if (opts?.skipFoodBev) {
    return {
      revenue,
      revenueIncVat,
      itemsCount,
      foodRevenue: 0,
      beverageRevenue: 0,
    }
  }

  const { food, drinks } = await sumFoodBeverageFromHourAggregates(db, match)

  return {
    revenue,
    revenueIncVat,
    itemsCount,
    foodRevenue: food,
    beverageRevenue: drinks,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** One aggregation: daily revenue + items from bork_business_days. */
export async function fetchBorkDailyTotals(
  db: Db,
  ctx: Pick<DailyOpsRevenueQueryContext, 'startDate' | 'endDate' | 'locationId'>,
): Promise<Map<string, { date: string; revenue: number; itemsCount: number }>> {
  const suffix = resolveBorkAggReadSuffix()
  const rows = await db
    .collection(`bork_business_days${suffix}`)
    .aggregate([
      { $match: borkRevenueMatch(ctx) },
      {
        $group: {
          _id: '$business_date',
          revenue: { $sum: BORK_DOC_REVENUE_EXPR },
          itemsCount: { $sum: { $ifNull: ['$total_quantity', 0] } },
        },
      },
    ])
    .toArray()

  const map = new Map<string, { date: string; revenue: number; itemsCount: number }>()
  for (const r of rows) {
    const date = String(r._id ?? '')
    if (!date) continue
    map.set(date, {
      date,
      revenue: round2(Number((r as { revenue?: number }).revenue ?? 0)),
      itemsCount: Number((r as { itemsCount?: number }).itemsCount ?? 0),
    })
  }
  return map
}

export async function fetchCategoriesFromBork(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<Map<string, { revenue: number; itemsCount: number }>> {
  const suffix = resolveBorkAggReadSuffix()
  const coll = `bork_sales_by_product${suffix}`
  const rows = await db
    .collection(coll)
    .aggregate([
      { $match: borkRevenueMatch(ctx) },
      {
        $group: {
          _id: { $ifNull: ['$categoryName', '$category', 'Overig'] },
          revenue: { $sum: BORK_DOC_REVENUE_EXPR },
          itemsCount: { $sum: { $ifNull: ['$total_quantity', 0] } },
        },
      },
    ])
    .toArray()

  const map = new Map<string, { revenue: number; itemsCount: number }>()
  for (const r of rows) {
    const id = r._id as string | { toString(): string }
    const name = typeof id === 'string' ? id : String(id)
    map.set(name, {
      revenue: Number((r as { revenue?: number }).revenue ?? 0),
      itemsCount: Number((r as { itemsCount?: number }).itemsCount ?? 0),
    })
  }
  return map
}

export async function fetchProductsFromBork(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<Map<string, { revenue: number; itemsCount: number }>> {
  const suffix = resolveBorkAggReadSuffix()
  const coll = `bork_sales_by_product${suffix}`
  const rows = await db
    .collection(coll)
    .aggregate([
      { $match: borkRevenueMatch(ctx) },
      {
        $group: {
          _id: { $ifNull: ['$productName', '$product_name', 'Onbekend'] },
          revenue: { $sum: BORK_DOC_REVENUE_EXPR },
          itemsCount: { $sum: { $ifNull: ['$total_quantity', 0] } },
        },
      },
    ])
    .toArray()

  const map = new Map<string, { revenue: number; itemsCount: number }>()
  for (const r of rows) {
    const name = String(r._id ?? 'Onbekend')
    map.set(name, {
      revenue: Number((r as { revenue?: number }).revenue ?? 0),
      itemsCount: Number((r as { itemsCount?: number }).itemsCount ?? 0),
    })
  }
  return map
}

export type HourlyMatrixAccumCell = {
  revenue: number
  itemsCount: number
  foodRevenue: number
  drinksRevenue: number
}

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]

/** Fill 24×7 matrix from bork_sales_by_hour (business_date × calendar_hour). */
export async function fillHourlyMatrixFromBork(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
  accum: HourlyMatrixAccumCell[][],
): Promise<void> {
  const suffix = resolveBorkAggReadSuffix()
  const [rows, catalogResolver] = await Promise.all([
    db
      .collection(`bork_sales_by_hour${suffix}`)
      .find(borkRevenueMatch(ctx))
      .project({
        business_date: 1,
        calendar_hour: 1,
        business_hour: 1,
        total_revenue_ex_vat: 1,
        total_revenue: 1,
        total_quantity: 1,
        products: 1,
      })
      .toArray(),
    loadProductCatalogResolver(db, {
      salesRange: { range_start: ctx.startDate, range_end: ctx.endDate },
    }),
  ])

  for (const doc of rows) {
    const d = doc as Record<string, unknown>
    const businessDate = String(d.business_date ?? '')
    if (!businessDate) continue
    const dow = new Date(`${businessDate}T12:00:00Z`).getUTCDay()
    const col = DOW_ORDER.indexOf(dow)
    if (col < 0) continue
    const hour = Number(d.calendar_hour ?? d.business_hour ?? 0)
    if (hour < 0 || hour > 23) continue
    const cell = accum[hour]![col]!
    const rev = docRevenueEx(d)
    cell.revenue += rev
    cell.itemsCount += Number(d.total_quantity ?? 0)
    const products =
      (d.products as Array<{ productId?: string; productName?: string; revenue_ex_vat?: number; revenue?: number }>) ??
      []
    for (const p of products) {
      const pRev = Number(p.revenue_ex_vat ?? p.revenue ?? 0)
      const split = splitLineRevenueByCatalog(
        String(p.productId ?? ''),
        String(p.productName ?? ''),
        pRev,
        new Map(),
        catalogResolver,
      )
      cell.drinksRevenue += split.drinks
      cell.foodRevenue += split.food
    }
    if (products.length === 0 && rev > 0) {
      cell.foodRevenue += rev
    }
  }
}

export function matrixTotalRevenue(accum: HourlyMatrixAccumCell[][]): number {
  let t = 0
  for (const row of accum) {
    for (const c of row) t += c.revenue
  }
  return t
}
