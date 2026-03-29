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

/** Per-product overrides in a menu (row-level display and calculation overrides) */
export type MenuProductOverride = {
  /** Display name (overrides product title) */
  displayName?: string
  /** Brand name */
  brand?: string
  /** Product type / style (e.g. Radler, Kriek) */
  productType?: string
  /** Description text */
  description?: string
  /** Supplier / leverancier */
  supplier?: string
  /** Batch cost (e.g. krat price); used for cost/item when itemsPerBatch set */
  batchCost?: number
  /** Items per batch (e.g. 24); used with batchCost for cost/item */
  itemsPerBatch?: number
  /** Override cost per item; if set, batchCost/itemsPerBatch ignored for calc */
  costPerItem?: number
  wastePercent?: number
  marginMultiplier?: number
  vatRate?: VatRate
  /** If set, margin is derived from this (menu price inc VAT). */
  menuPriceIncVat?: number
}

/** Sub-cards (sub-menus) per menu: custom sections with your own names */
export type MenuSection = {
  id: string
  name: string
  productIds: string[]
  /** Per-product overrides; key = productId */
  productOverrides?: Record<string, MenuProductOverride>
}

/** Global defaults for the menu builder (waste %, margin multiplier, BTW) */
export type MenuBuilderDefaults = {
  defaultWastePercent?: number
  defaultMarginMultiplier?: number
  defaultVatRate?: VatRate
}

/** Legacy: object keyed by section name. Prefer menuSections (array). */
export type MenuSections = {
  drinks?: string[]
  diner?: string[]
  snacks?: string[]
  dessert?: string[]
  coursesMenu?: string[]
}

export type Menu = {
  _id?: string
  name: string
  startDate?: string
  location?: string
  /** Custom sections (your own names). Replaces legacy sections object. */
  menuSections?: MenuSection[]
  /** @deprecated Use menuSections instead */
  sections?: MenuSections
  /** Global defaults for calculations in builder */
  defaultWastePercent?: number
  defaultMarginMultiplier?: number
  defaultVatRate?: VatRate
  createdAt?: Date
  updatedAt?: Date
}
