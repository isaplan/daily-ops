export type ProductCatalogCategory = 'food' | 'beverage' | 'other'

export type ProductCatalogVatLabel = '21' | '6' | 'unknown'

export type ProductCatalogLocationRow = {
  location_id: string
  location_name: string
  list_price_inc_vat: number | null
  list_price_ex_vat: number | null
  vat_percent: 21 | 6 | null
  vat_label: ProductCatalogVatLabel
  group_key: string | null
  group_name: string | null
  sub_category: string | null
  category: ProductCatalogCategory
  /** Last sold unit price in period (when differs from list) */
  sold_unit_price_inc_vat: number | null
  sold_quantity: number
  sold_revenue_inc_vat: number
  sold_revenue_ex_vat: number
}

export type ProductCatalogDoc = {
  product_key: string
  display_name: string
  family_name: string
  size_label: string | null
  category: ProductCatalogCategory
  sub_category: string | null
  vat_percent: 21 | 6 | null
  vat_label: ProductCatalogVatLabel
  location_ids: string[]
  locations: ProductCatalogLocationRow[]
  sources: {
    api_catalog_at?: string
    sales_seen_at?: string
  }
  updated_at: Date
}

export type ProductCatalogHubRow = ProductCatalogDoc & {
  sold_quantity: number
  sold_revenue_inc_vat: number
  sold_revenue_ex_vat: number
  price_range_inc_vat: { min: number | null; max: number | null }
}

export type ProductCatalogDateRange = {
  range_start: string
  range_end: string
}
