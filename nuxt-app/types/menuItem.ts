/**
 * Menu item types for Daily Menu & Products.
 * See dev-docs/menu-item-schema.md for full schema and VAT rules.
 */

export const VAT_LOW = 9
export const VAT_HIGH = 21
export type VatRate = 9 | 21

export type MenuItemCategory =
  | 'wine'
  | 'beer'
  | 'spirit'
  | 'cocktail'
  | 'coffee'
  | 'soft'
  | 'food'
  | 'other'

export type CalculationMethod = 'simple' | 'opslag' | 'recipe_margin' | 'by_portion'

export type MenuItemOpslagScenario = {
  label: string
  costOfSalesPercent?: number
  marginMultiplier?: number
  calculatedNetPrice?: number
}

export type MenuItem = {
  _id?: string
  /** Dump mode: product group from filename (rum, cocktail, wine, etc.) */
  productGroup?: string
  /** Dump mode: original filename */
  sourceFile?: string
  /** Dump mode: 1-based row index in CSV */
  rowIndex?: number
  /** Dump mode: all columns mapped by header name */
  data?: Record<string, unknown>
  name?: string
  description?: string
  type?: MenuItemCategory
  subType?: string
  alcohol?: boolean
  alcoholPercent?: number
  vatRate?: VatRate
  regio?: string
  land?: string
  jaar?: string
  sortOrder?: number
  sourceImportId?: string
  calculationMethod?: CalculationMethod
  costPricePerItem?: number
  wastePercent?: number
  marginMultiplier?: number
  priceExVat?: number
  priceIncVat?: number
  unitPrice?: number
  costPerPieceAfterWaste?: number
  wastePercentOpslag?: number
  targetCostOfSalesPercent?: number
  targetMarginMultiplier?: number
  opslagScenarios?: MenuItemOpslagScenario[]
  recipeCost?: number
  recipeComponents?: Array<{ name: string; quantity?: string; cost?: number }>
  batchSizeUnit?: 'g' | 'kg' | 'ml' | 'L'
  batchSize?: number
  batchCost?: number
  portions?: Array<{
    name: string
    sizePerUnit: number
    unit?: 'g' | 'ml'
    costPerPortion?: number
    marginMultiplier?: number
    priceExVat?: number
    priceIncVat?: number
  }>
  defaultPriceExVat?: number
  defaultPriceIncVat?: number
  documentRefs?: Array<{ id: string; type: 'recipe' | 'menukaart' | 'note'; name?: string }>
  createdAt?: Date
  updatedAt?: Date
}

export type MenuImportResult = {
  success: boolean
  imported: number
  updated: number
  failed: number
  errors: Array<{ row: number; error: string }>
}

export type Menu = {
  _id?: string
  name: string
  createdAt?: Date
  updatedAt?: Date
}
