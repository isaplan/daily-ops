/**
 * @registry-id: dailyOpsRevenueFetchRange
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Revenue + items for a date range (snapshot-first, Bork fallback)
 * @last-fix: [2026-05-20] Initial
 *
 * @exports-to:
 * ✓ server/api/daily-ops/revenue/*
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import type { DailyOpsRevenueQueryContext } from '~/types/daily-ops-revenue'
import { eachBusinessDate } from './dateRange'
import { resolveBorkAggReadSuffix } from '../borkAggVersionSuffix'
import { BORK_DOC_REVENUE_EXPR } from '../dailyOpsDashboardMetrics'

export type RevenueRangeTotals = {
  revenue: number
  itemsCount: number
  foodRevenue: number
  beverageRevenue: number
  leadSource: 'inbox_basis' | 'bork_api' | 'unknown'
}

async function sumFromSnapshots(
  db: Db,
  ctx: Pick<DailyOpsRevenueQueryContext, 'startDate' | 'endDate' | 'locationId'>,
): Promise<RevenueRangeTotals | null> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId

  const rows = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection).find(filter).toArray()
  if (rows.length === 0) return null

  let revenue = 0
  let itemsCount = 0
  let inboxDays = 0
  for (const r of rows) {
    const doc = r as Record<string, unknown>
    const totals = doc.totals as { ex_vat?: number; quantity?: number } | undefined
    revenue += Number(totals?.ex_vat ?? 0)
    itemsCount += Number(totals?.quantity ?? 0)
    if (doc.leadSource === 'inbox') inboxDays++
  }

  const foodBev = await sumFoodBevFromProductSnapshots(db, ctx)
  return {
    revenue,
    itemsCount,
    foodRevenue: foodBev.food,
    beverageRevenue: foodBev.beverage,
    leadSource: inboxDays > 0 ? 'inbox_basis' : 'bork_api',
  }
}

async function sumFoodBevFromProductSnapshots(
  db: Db,
  ctx: Pick<DailyOpsRevenueQueryContext, 'startDate' | 'endDate' | 'locationId'>,
): Promise<{ food: number; beverage: number }> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId
  const rows = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection).find(filter).toArray()
  let food = 0
  let beverage = 0
  const drinkRe =
    /drank|bier|wine|wijn|bar|cocktail|koffie|thee|limonade|gin|vodka|whisk|rum|cola|fanta|prosecco|cider|tap|fles speciaalbier|wijnen/i
  for (const doc of rows) {
    const cats = (doc as { categories?: Array<{ name: string; revenue_ex_vat: number }> }).categories ?? []
    for (const c of cats) {
      if (drinkRe.test(c.name)) beverage += c.revenue_ex_vat
      else if (/keuken|food|kitchen/i.test(c.name)) food += c.revenue_ex_vat
    }
  }
  if (food + beverage > 0) return { food, beverage }
  return { food: 0, beverage: 0 }
}

async function sumFromBork(
  db: Db,
  ctx: Pick<DailyOpsRevenueQueryContext, 'startDate' | 'endDate' | 'locationId'>,
): Promise<RevenueRangeTotals> {
  const suffix = resolveBorkAggReadSuffix()
  const coll = `bork_business_days${suffix}`
  const match: Record<string, unknown> = {
    business_date: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId && ObjectId.isValid(ctx.locationId)) {
    match.locationId = new ObjectId(ctx.locationId)
  }

  const agg = await db
    .collection(coll)
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          revenue: { $sum: BORK_DOC_REVENUE_EXPR },
          itemsCount: { $sum: { $ifNull: ['$total_quantity', 0] } },
        },
      },
    ])
    .toArray()

  const row = agg[0] as { revenue?: number; itemsCount?: number } | undefined
  const hourColl = `bork_sales_by_hour${suffix}`
  const hourMatch = { ...match }
  const catAgg = await db
    .collection(hourColl)
    .aggregate([
      { $match: hourMatch },
      { $unwind: { path: '$products', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: null,
          food: {
            $sum: {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: ['$products.productName', ''] },
                    regex: 'drank|bier|wine|wijn|cocktail|koffie|thee|limonade',
                    options: 'i',
                  },
                },
                0,
                { $ifNull: ['$products.total_revenue_ex_vat', '$products.total_revenue', 0] },
              ],
            },
          },
          beverage: {
            $sum: {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: ['$products.productName', ''] },
                    regex: 'drank|bier|wine|wijn|cocktail|koffie|thee|limonade',
                    options: 'i',
                  },
                },
                { $ifNull: ['$products.total_revenue_ex_vat', '$products.total_revenue', 0] },
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray()
  const cat = catAgg[0] as { food?: number; beverage?: number } | undefined

  return {
    revenue: Number(row?.revenue ?? 0),
    itemsCount: Number(row?.itemsCount ?? 0),
    foodRevenue: Number(cat?.food ?? 0),
    beverageRevenue: Number(cat?.beverage ?? 0),
    leadSource: 'bork_api',
  }
}

export async function fetchRevenueRange(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<RevenueRangeTotals> {
  const slice = {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId,
  }
  const snap = await sumFromSnapshots(db, slice)
  if (snap && snap.revenue > 0) return snap
  return sumFromBork(db, slice)
}

export async function fetchRevenueRangeForDates(
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<RevenueRangeTotals> {
  return fetchRevenueRange(db, {
    period: 'custom',
    startDate,
    endDate,
    label: '',
    compareKind: 'none',
    locationId,
  })
}

export function listDatesInRange(startDate: string, endDate: string): string[] {
  return [...eachBusinessDate(startDate, endDate)]
}
