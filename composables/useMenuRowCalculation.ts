/**
 * @registry-id: useMenuRowCalculation
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Composable for menu row pricing calculations (cost → waste → nett → menu price)
 * @last-fix: [2026-03-02] Initial composable creation
 * @exports-to:
 * ✓ nuxt-app/pages/daily-menu-products/menu-builder/[id].vue => useMenuRowCalculation for price calculations
 * 
 * Menu row pricing: cost → waste → nett (ex VAT) → menu price (inc VAT).
 * - costPerItem = batchPrice / batchQty or itemPrice
 * - wasteCost = costPerItem * (wastePercent/100)
 * - costPlusWaste = costPerItem + wasteCost
 * - If menuPriceIncVat set: nett = menuPrice / (1+BTW), margin = nett / costPlusWaste
 * - Else: nett = costPlusWaste * marginMultiplier, menuPrice = nett * (1+BTW)
 */

import type { VatRate } from '~/types/menuItem'

export type MenuRowCalculationInput = {
  /** Cost per item (batch price / batch qty, or item price) */
  costPerItem: number
  /** 0–100 */
  wastePercent: number
  /** Margin multiplier (e.g. 2.7 => nett = costPlusWaste * 2.7). Ignored if menuPriceIncVat is set. */
  marginMultiplier: number
  /** BTW 9 or 21 */
  vatRate: VatRate
  /** If set, we back-calculate margin from this. */
  menuPriceIncVat?: number | null
}

export type MenuRowCalculationResult = {
  costPerItem: number
  wasteCost: number
  costPlusWaste: number
  /** Nett price (ex VAT) */
  nettPrice: number
  /** Menu price (inc VAT) */
  menuPriceIncVat: number
  /** Effective margin multiplier (nett / costPlusWaste) */
  marginMultiplier: number
  /** Margin as percentage: (nett - costPlusWaste) / costPlusWaste * 100 */
  marginPercent: number
}

export function useMenuRowCalculation(input: MenuRowCalculationInput): MenuRowCalculationResult {
  const wasteCost = input.costPerItem * (input.wastePercent / 100)
  const costPlusWaste = input.costPerItem + wasteCost

  let nettPrice: number
  let marginMultiplier: number

  if (
    input.menuPriceIncVat != null &&
    input.menuPriceIncVat > 0 &&
    costPlusWaste > 0
  ) {
    nettPrice = input.menuPriceIncVat / (1 + input.vatRate / 100)
    marginMultiplier = nettPrice / costPlusWaste
  } else {
    marginMultiplier = input.marginMultiplier
    nettPrice = costPlusWaste * marginMultiplier
  }

  const menuPriceIncVat = nettPrice * (1 + input.vatRate / 100)
  const marginPercent =
    costPlusWaste > 0 ? ((nettPrice - costPlusWaste) / costPlusWaste) * 100 : 0

  return {
    costPerItem: input.costPerItem,
    wasteCost,
    costPlusWaste,
    nettPrice,
    menuPriceIncVat,
    marginMultiplier,
    marginPercent,
  }
}

/** Parse a number from product data (e.g. "€ 1,55" or "24"). */
export function parseProductNumber(val: unknown): number {
  if (val == null) return 0
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  const s = String(val).replace(/\s/g, '').replace(/€/g, '').replace(',', '.')
  const n = parseFloat(s)
  return Number.isNaN(n) ? 0 : n
}

/** Get cost per item: batchPrice / batchQty, or item price. */
export function getCostPerItemFromProduct(
  data: Record<string, unknown> | undefined,
  batchPrice?: number,
  batchQty?: number,
  itemPrice?: number
): number {
  if (data && typeof data === 'object') {
    const batchP =
      batchPrice ??
      parseProductNumber(
        data['Inkoop Prijs'] ?? data['Eenheid Prijs'] ?? data['Inkoop']
      )
    const batchQ =
      batchQty ??
      parseProductNumber(
        data['aantal per Items '] ?? data['aantal per Items'] ?? data['Items']
      )
    if (batchP > 0 && batchQ > 0) return batchP / batchQ
    const item =
      itemPrice ??
      parseProductNumber(
        data['Per Stuk prijs'] ??
          data['Kostprijs per stuk (waste %)'] ??
          data['Kostprijs per stuk']
      )
    if (item > 0) return item
  }
  if (batchPrice != null && batchQty != null && batchPrice > 0 && batchQty > 0) {
    return batchPrice / batchQty
  }
  return itemPrice ?? 0
}

/** Get batch price from product data */
export function getBatchFromProduct(
  data: Record<string, unknown> | undefined,
  fallback?: number
): number {
  if (data && typeof data === 'object') {
    return parseProductNumber(
      data['Inkoop Prijs'] ?? data['Eenheid Prijs'] ?? data['Inkoop']
    )
  }
  return fallback ?? 0
}

/** Get items per batch from product data */
export function getItemsFromProduct(
  data: Record<string, unknown> | undefined,
  fallback?: number
): number {
  if (data && typeof data === 'object') {
    return parseProductNumber(
      data['aantal per Items '] ?? data['aantal per Items'] ?? data['Items']
    )
  }
  return fallback ?? 0
}

/** Get supplier from product data */
export function getSupplierFromProduct(data: Record<string, unknown> | undefined): string {
  if (data && typeof data === 'object') {
    const supplier = data['Supplier'] ?? data['supplier'] ?? data['Leverancier']
    if (supplier) return String(supplier)
  }
  return ''
}

/** Get cost per item for a specific size by batch type */
export function getCostPerItemByBatchType(
  batchPrice: number,
  batchSize: number,
  refSize: number,
  batchType: string,
  targetSize: number
): number {
  if (batchSize <= 0 || batchPrice <= 0) return 0
  const costPerUnit = batchPrice / batchSize
  if (batchType === 'bag' || batchType === 'crate') {
    return costPerUnit * (targetSize / refSize)
  }
  return costPerUnit
}

/** Get cost per 1cL for a product */
export function getCostPer1Cl(
  batchPrice: number,
  batchSize: number,
  batchType: string,
  refSize?: number
): number {
  if (batchSize <= 0 || batchPrice <= 0) return 0
  if (batchType === 'bag' || batchType === 'crate') {
    return refSize && refSize > 0 ? (batchPrice / batchSize) * (1 / refSize) : 0
  }
  return batchPrice / batchSize
}
