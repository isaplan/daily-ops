/**
 * @registry-id: dailyOpsPeriodCacheClassifyFoodBeverage
 * @created: 2026-08-08T21:20:00.000Z
 * @last-modified: 2026-08-08T21:20:00.000Z
 * @description: Food/beverage classifier — catalog → inbox digest → flagged regex
 * @last-fix: [2026-08-09] @adr-ref → PERIOD_CACHE_ADR L3
 * @adr-ref: PERIOD_CACHE_ADR L3
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsPeriodCache/buildDayNode.ts
 * ✓ scripts/validate-period-cache.ts
 */

import type { Db } from 'mongodb'
import {
  BORK_DRINK_NAME_FALLBACK,
  isBeverageCategoryName,
  loadProductCatalogCategoryMap,
} from '../borkFoodBeverageSplit'
import type { ProductCatalogCategory } from '~/types/product-catalog'

export type FoodBeverageTier = 'catalog' | 'inbox_digest' | 'regex_fallback'

export type ClassifiedProduct = {
  productId: string
  productName: string
  bucket: 'food' | 'beverage'
  tier: FoodBeverageTier
  exVat: number
  qty: number
}

export type FoodBeverageSplitResult = {
  food: number
  beverage: number
  byCategory: Array<{ name: string; exVat: number; qty: number }>
  classified: ClassifiedProduct[]
  /** Product IDs that used regex name-match — data gaps for ops. */
  regexFallbackProductIds: string[]
}

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

/** Inbox / snapshot category name → food | beverage | skip. */
export function bucketFromInboxCategoryName (
  name: string,
): 'food' | 'beverage' | 'skip' {
  const n = name.trim().toLowerCase()
  if (/^non-food|^meldingen$/.test(n)) return 'skip'
  if (isBeverageCategoryName(name)) return 'beverage'
  if (n === 'keuken' || /^food|kitchen/.test(n)) return 'food'
  // Unknown inbox category → food bucket (digest SSOT, not a guess)
  return 'food'
}

/**
 * Roll up from inbox/snapshot category rows (tier 2).
 * Prefer this when categories exist — no product-level guessing.
 */
export function splitFromInboxCategories (
  categories: Array<{ name: string; revenue_ex_vat: number; quantity: number }>,
): FoodBeverageSplitResult {
  let food = 0
  let beverage = 0
  const byCategory: FoodBeverageSplitResult['byCategory'] = []

  for (const c of categories) {
    const bucket = bucketFromInboxCategoryName(c.name)
    if (bucket === 'skip') continue
    const exVat = Number(c.revenue_ex_vat ?? 0)
    const qty = Number(c.quantity ?? 0)
    byCategory.push({ name: c.name, exVat, qty })
    if (bucket === 'beverage') beverage += exVat
    else food += exVat
  }

  return {
    food: round2(food),
    beverage: round2(beverage),
    byCategory,
    classified: [],
    regexFallbackProductIds: [],
  }
}

/**
 * Product-level classify: catalog category first, then regex (flagged).
 */
export async function classifyProductsWithCatalog (
  db: Db,
  products: Array<{
    productId: string
    productName: string
    revenue_ex_vat: number
    quantity: number
  }>,
  salesRange?: { range_start: string; range_end: string },
): Promise<FoodBeverageSplitResult> {
  const catalogMap = await loadProductCatalogCategoryMap(
    db,
    salesRange ? { salesRange } : undefined,
  )

  let food = 0
  let beverage = 0
  const classified: ClassifiedProduct[] = []
  const regexFallbackProductIds: string[] = []
  const catMap = new Map<string, { exVat: number; qty: number }>()

  for (const p of products) {
    const exVat = Number(p.revenue_ex_vat ?? 0)
    const qty = Number(p.quantity ?? 0)
    const cat = catalogMap.get(p.productId) as ProductCatalogCategory | undefined

    let bucket: 'food' | 'beverage'
    let tier: FoodBeverageTier

    if (cat === 'beverage') {
      bucket = 'beverage'
      tier = 'catalog'
    } else if (cat === 'food') {
      bucket = 'food'
      tier = 'catalog'
    } else if (BORK_DRINK_NAME_FALLBACK.test(p.productName)) {
      bucket = 'beverage'
      tier = 'regex_fallback'
      regexFallbackProductIds.push(p.productId)
    } else {
      bucket = 'food'
      tier = cat === 'other' ? 'catalog' : 'regex_fallback'
      if (tier === 'regex_fallback' && p.productId) {
        regexFallbackProductIds.push(p.productId)
      }
    }

    if (bucket === 'beverage') beverage += exVat
    else food += exVat

    const label = bucket === 'beverage' ? 'Dranken' : 'Keuken'
    const prev = catMap.get(label) ?? { exVat: 0, qty: 0 }
    prev.exVat += exVat
    prev.qty += qty
    catMap.set(label, prev)

    classified.push({
      productId: p.productId,
      productName: p.productName,
      bucket,
      tier,
      exVat,
      qty,
    })
  }

  return {
    food: round2(food),
    beverage: round2(beverage),
    byCategory: Array.from(catMap.entries()).map(([name, v]) => ({
      name,
      exVat: round2(v.exVat),
      qty: v.qty,
    })),
    classified,
    regexFallbackProductIds: [...new Set(regexFallbackProductIds)],
  }
}

/** Scale food/bev so they sum to headline (when category rollup ≠ sealed total). */
export function scaleFoodBeverageToHeadline (
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
