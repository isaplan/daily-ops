/**
 * @registry-id: borkFoodBeverageSplit
 * @created: 2026-05-23T00:00:00.000Z
 * @last-modified: 2026-06-02T23:30:00.000Z
 * @description: Food vs beverage revenue using product_catalog (Hoofdgroep), with name fallback
 * @last-fix: [2026-06-02] Reject stale product_key hits when sold name ≠ catalog name; name fallback lookup
 *   Prior: [2026-06-02] Export shared beverage classifiers for drilldown top-10
 *   Prior: [2026-05-23] Replace product-name-only heuristic for Daily Ops revenue splits
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsDashboardMetrics.ts => fetchRevenueByCategoryFromHourAggregates
 * ✓ server/utils/dailyOpsRevenue/borkRevenueRead.ts => fetchBorkRangeTotals, fillHourlyMatrixFromBork
 * ✓ server/utils/dailyOpsSnapshot/buildRevenueProductsSection.ts => snapshot category rollups
 * ✓ server/utils/dailyOpsSnapshot/drilldown/buildRevenueDrilldownTop10.ts => food vs beverage top-10 split
 */

import type { Db } from 'mongodb'
import { resolveBorkAggReadSuffix } from './borkAggVersionSuffix'
import {
  classifyCategoryFromCatalogFields,
  isExcludedCatalogForCalculations,
  loadSoldQuantityByProductKey,
  PRODUCT_CATALOG_LOOKUP_PIPELINE,
} from './productCatalog'
import type {
  ProductCatalogCategory,
  ProductCatalogDateRange,
  ProductCatalogDoc,
} from '~/types/product-catalog'

/** Fallback when product_key is missing from product_catalog (pre-sync or legacy keys). */
export const BORK_DRINK_NAME_FALLBACK =
  /wine|wijn|beer|bier|birra|moretti|gint|gin |vodka|whisk|whiskey|rum|cocktail|cola|sprite|fanta|coffee|koffie|thee|tea|sap|juice|fris|prosecco|champagne|cider|tonic|latte|cappuccino|espresso|pils|stelz|borrel|aperol|campari|martini|soda|limonade|heineken|amstel|jupiler|desperados|radler|affligem|duvel|warchest|\btap\b/i

export type ProductCatalogLookupEntry = {
  category: ProductCatalogCategory
  displayName: string
  hoofdgroep: string | null
  sub_category: string | null
}

export type ProductCatalogResolver = {
  byKey: Map<string, ProductCatalogLookupEntry>
  byName: Map<string, ProductCatalogLookupEntry>
}

function normalizeProductLabel(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Sold line name must align with catalog row — Bork reuses product_key across products over time. */
export function catalogNamesAlign(catalogName: string, soldName: string): boolean {
  const a = normalizeProductLabel(catalogName)
  const b = normalizeProductLabel(soldName)
  if (!a || !b) return false
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length >= 5 && long.includes(short)
}

const LINE_EX_VAT_EXPR = {
  $toDouble: {
    $let: {
      vars: {
        ex: { $ifNull: ['$products.revenue_ex_vat', 0] },
        gross: { $ifNull: ['$products.revenue', 0] },
      },
      in: { $cond: [{ $gt: ['$$ex', 0] }, '$$ex', '$$gross'] },
    },
  },
} as const

const BUCKET_FROM_CATALOG_OR_NAME = {
  $switch: {
    branches: [
      { case: { $eq: ['$catalogCategory', 'beverage'] }, then: 'drinks' },
      { case: { $eq: ['$catalogCategory', 'food'] }, then: 'food' },
    ],
    default: {
      $cond: {
        if: {
          $regexMatch: {
            input: { $ifNull: ['$productName', ''] },
            regex: BORK_DRINK_NAME_FALLBACK.source,
            options: 'i',
          },
        },
        then: 'drinks',
        else: 'food',
      },
    },
  },
} as const

const CATEGORY_FROM_LINES_PIPELINE = [
  { $unwind: { path: '$products', preserveNullAndEmptyArrays: false } },
  {
    $lookup: {
      from: 'product_catalog',
      let: { pid: { $toString: { $ifNull: ['$products.productId', ''] } } },
      pipeline: [...PRODUCT_CATALOG_LOOKUP_PIPELINE],
      as: 'catalogHit',
    },
  },
  {
    $addFields: {
      catalogCategory: { $arrayElemAt: ['$catalogHit.category', 0] },
      productName: { $ifNull: ['$products.productName', ''] },
      lineEx: LINE_EX_VAT_EXPR,
    },
  },
  { $addFields: { bucket: BUCKET_FROM_CATALOG_OR_NAME } },
  { $group: { _id: '$bucket', amount: { $sum: '$lineEx' } } },
] as const

export async function sumFoodBeverageFromHourAggregates(
  db: Db,
  match: Record<string, unknown>,
): Promise<{ food: number; drinks: number }> {
  const sfx = resolveBorkAggReadSuffix()
  const coll = `bork_sales_by_hour${sfx}`

  const [facetRow] = (await db
    .collection(coll)
    .aggregate([
      { $match: match },
      {
        $facet: {
          categoryFromLines: CATEGORY_FROM_LINES_PIPELINE,
          hourRevenueTotal: [
            {
              $group: {
                _id: null,
                total: { $sum: { $ifNull: ['$total_revenue_ex_vat', '$total_revenue', 0] } },
              },
            },
          ],
          productLinesTotal: [
            { $unwind: { path: '$products', preserveNullAndEmptyArrays: false } },
            { $group: { _id: null, total: { $sum: LINE_EX_VAT_EXPR } } },
          ],
        },
      },
    ])
    .toArray()) as {
    categoryFromLines: { _id: string; amount: number }[]
    hourRevenueTotal: { _id: null; total: number }[]
    productLinesTotal: { _id: null; total: number }[]
  }[]

  const byCat = facetRow?.categoryFromLines ?? []
  let drinks = byCat.find((x) => x._id === 'drinks')?.amount ?? 0
  let food = byCat.find((x) => x._id === 'food')?.amount ?? 0
  const hourGrand = facetRow?.hourRevenueTotal?.[0]?.total ?? 0
  const lineGrand = facetRow?.productLinesTotal?.[0]?.total ?? 0
  const gap = Math.max(0, hourGrand - lineGrand)
  food += gap

  return { food, drinks }
}

export async function loadProductCatalogResolver(
  db: Db,
  opts?: { salesRange?: ProductCatalogDateRange },
): Promise<ProductCatalogResolver> {
  const rows = await db
    .collection('product_catalog')
    .find(
      {},
      { projection: { product_key: 1, category: 1, display_name: 1, locations: 1, hoofdgroep: 1, sub_category: 1 } },
    )
    .toArray()

  const soldByKey = opts?.salesRange
    ? await loadSoldQuantityByProductKey(db, opts.salesRange)
    : undefined

  const byKey = new Map<string, ProductCatalogLookupEntry>()
  const byName = new Map<string, ProductCatalogLookupEntry>()

  for (const doc of rows) {
    const key = String((doc as { product_key?: string }).product_key ?? '')
    const cat = (doc as { category?: ProductCatalogCategory }).category
    const displayName = String((doc as { display_name?: string }).display_name ?? '')
    if (!key || !cat || !displayName) continue
    const sold = soldByKey?.get(key) ?? 0
    if (
      isExcludedCatalogForCalculations(
        doc as { display_name: string; locations: ProductCatalogDoc['locations'] },
        sold,
      )
    ) {
      continue
    }
    const entry: ProductCatalogLookupEntry = {
      category: cat,
      displayName,
      hoofdgroep: (doc as { hoofdgroep?: string | null }).hoofdgroep ?? null,
      sub_category: (doc as { sub_category?: string | null }).sub_category ?? null,
    }
    byKey.set(key, entry)
    const nameKey = normalizeProductLabel(displayName)
    const prev = byName.get(nameKey)
    if (!prev || entry.category === 'food' || entry.category === 'beverage') {
      byName.set(nameKey, entry)
    }
  }

  return { byKey, byName }
}

export async function loadProductCatalogCategoryMap(
  db: Db,
  opts?: { salesRange?: ProductCatalogDateRange },
): Promise<Map<string, ProductCatalogCategory>> {
  const resolver = await loadProductCatalogResolver(db, opts)
  const map = new Map<string, ProductCatalogCategory>()
  for (const [key, entry] of resolver.byKey) {
    map.set(key, entry.category)
  }
  return map
}

export function resolveProductCatalogEntry(
  productId: string,
  productName: string,
  resolver: ProductCatalogResolver,
): ProductCatalogLookupEntry | null {
  const soldName = String(productName ?? '').trim()
  const byId = resolver.byKey.get(String(productId ?? '').trim())
  if (byId && catalogNamesAlign(byId.displayName, soldName)) return byId
  if (soldName) {
    const bySoldName = resolver.byName.get(normalizeProductLabel(soldName))
    if (bySoldName) return bySoldName
  }
  return null
}

export function classifyProductFoodBeverage(
  productId: string,
  productName: string,
  resolver: ProductCatalogResolver,
): 'food' | 'beverage' {
  const entry = resolveProductCatalogEntry(productId, productName, resolver)
  if (entry?.category === 'beverage') return 'beverage'
  if (entry?.category === 'food') return 'food'
  if (entry) {
    const derived = classifyCategoryFromCatalogFields(entry.hoofdgroep, entry.sub_category)
    if (derived === 'beverage') return 'beverage'
    if (derived === 'food') return 'food'
  }
  if (BORK_DRINK_NAME_FALLBACK.test(productName)) return 'beverage'
  return 'food'
}

export function splitLineRevenueByCatalog(
  productId: string,
  productName: string,
  revenueEx: number,
  catalogMap: Map<string, ProductCatalogCategory>,
  resolver?: ProductCatalogResolver,
): { food: number; drinks: number } {
  const bucket = resolver
    ? classifyProductFoodBeverage(productId, productName, resolver)
    : (() => {
        const cat = catalogMap.get(productId)
        if (cat === 'beverage') return 'beverage' as const
        if (cat === 'food') return 'food' as const
        if (BORK_DRINK_NAME_FALLBACK.test(productName)) return 'beverage' as const
        return 'food' as const
      })()
  if (bucket === 'beverage') return { food: 0, drinks: revenueEx }
  return { food: revenueEx, drinks: 0 }
}

/** Bork/inbox category label → beverage bucket (matches rollupFoodBeverageFromCategories). */
export function isBeverageCategoryName(name: string): boolean {
  const n = name.trim().toLowerCase()
  return (
    /^dranken\s+(hoog|laag)$/.test(n) ||
    /bierboetiek|bier\s*boetiek/.test(n) ||
    /^drank|bier|bar\b|tap\b|wijn|wine/.test(n)
  )
}

export function isBeverageProduct(
  productId: string,
  productName: string,
  resolver: ProductCatalogResolver,
): boolean {
  return classifyProductFoodBeverage(productId, productName, resolver) === 'beverage'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Scale category food/bev to match headline when product rollup ≠ revenue section total. */
export function proportionalFoodBeverageToHeadline(
  headlineExVat: number,
  food: number,
  beverage: number,
): { food: number; beverage: number } {
  const catTotal = food + beverage
  if (headlineExVat <= 0 || catTotal <= 0) {
    return { food: round2(food), beverage: round2(beverage) }
  }
  if (Math.abs(catTotal - headlineExVat) < 0.02) {
    return { food: round2(food), beverage: round2(beverage) }
  }
  const ratio = headlineExVat / catTotal
  return { food: round2(food * ratio), beverage: round2(beverage * ratio) }
}

export function rollupFoodBeverageFromCategories(
  categories: Array<{ name: string; revenue_ex_vat: number }>,
): { food: number; beverage: number } {
  let food = 0
  let beverage = 0
  for (const c of categories) {
    const name = c.name.trim().toLowerCase()
    if (
      /^dranken\s+(hoog|laag)$/.test(name) ||
      /bierboetiek|bier\s*boetiek/.test(name) ||
      /^drank|bier|bar\b|tap\b|wijn|wine/.test(name)
    ) {
      beverage += c.revenue_ex_vat
    } else if (name === 'keuken' || /^food|kitchen/.test(name)) {
      food += c.revenue_ex_vat
    } else if (/^non-food/.test(name)) {
      // skip or count as other
    } else {
      food += c.revenue_ex_vat
    }
  }
  return { food, beverage }
}
