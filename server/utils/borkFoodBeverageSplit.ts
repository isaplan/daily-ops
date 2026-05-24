/**
 * @registry-id: borkFoodBeverageSplit
 * @created: 2026-05-23T00:00:00.000Z
 * @last-modified: 2026-05-23T00:00:00.000Z
 * @description: Food vs beverage revenue using product_catalog (Hoofdgroep), with name fallback
 * @last-fix: [2026-05-23] Replace product-name-only heuristic for Daily Ops revenue splits
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsDashboardMetrics.ts => fetchRevenueByCategoryFromHourAggregates
 * ✓ server/utils/dailyOpsRevenue/borkRevenueRead.ts => fetchBorkRangeTotals, fillHourlyMatrixFromBork
 * ✓ server/utils/dailyOpsSnapshot/buildRevenueProductsSection.ts => snapshot category rollups
 */

import type { Db } from 'mongodb'
import { resolveBorkAggReadSuffix } from './borkAggVersionSuffix'
import {
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
  /wine|wijn|beer|bier|birra|moretti|gint|gin |vodka|whisk|whiskey|rum|cocktail|cola|sprite|fanta|coffee|koffie|thee|tea|sap|juice|fris|prosecco|champagne|cider|tonic|latte|cappuccino|espresso|pils|stelz|borrel|aperol|campari|martini|soda|limonade|heineken|amstel|jupiler|desperados|radler|affligem|duvel|warchest|tap/i

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

export async function loadProductCatalogCategoryMap(
  db: Db,
  opts?: { salesRange?: ProductCatalogDateRange },
): Promise<Map<string, ProductCatalogCategory>> {
  const rows = await db
    .collection('product_catalog')
    .find({}, { projection: { product_key: 1, category: 1, display_name: 1, locations: 1 } })
    .toArray()

  const soldByKey = opts?.salesRange
    ? await loadSoldQuantityByProductKey(db, opts.salesRange)
    : undefined

  const map = new Map<string, ProductCatalogCategory>()
  for (const doc of rows) {
    const key = String((doc as { product_key?: string }).product_key ?? '')
    const cat = (doc as { category?: ProductCatalogCategory }).category
    if (!key || !cat) continue
    const sold = soldByKey?.get(key) ?? 0
    if (
      isExcludedCatalogForCalculations(
        doc as { display_name: string; locations: ProductCatalogDoc['locations'] },
        sold,
      )
    ) {
      continue
    }
    map.set(key, cat)
  }
  return map
}

export function splitLineRevenueByCatalog(
  productId: string,
  productName: string,
  revenueEx: number,
  catalogMap: Map<string, ProductCatalogCategory>,
): { food: number; drinks: number } {
  const cat = catalogMap.get(productId)
  if (cat === 'beverage') return { food: 0, drinks: revenueEx }
  if (cat === 'food') return { food: revenueEx, drinks: 0 }
  if (BORK_DRINK_NAME_FALLBACK.test(productName)) return { food: 0, drinks: revenueEx }
  return { food: revenueEx, drinks: 0 }
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
