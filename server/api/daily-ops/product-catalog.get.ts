/**
 * @registry-id: dailyOpsProductCatalogGet
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-23T00:00:00.000Z
 * @description: Unified product_catalog hub — menu + last-N-day sales per variant row
 * @last-fix: [2026-05-24] Menu Builder prices on hub rows (menu_prices)
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/product-catalog.vue
 */

import { getDb } from '../../utils/db'
import {
  fetchProductCatalogHubPage,
  loadProductCatalogVenueOptions,
  normalizeProductCatalogDateRange,
  type ProductCatalogHubSortDir,
  type ProductCatalogHubSortField,
} from '../../utils/productCatalog'
import type { ProductCatalogCategory, ProductCatalogHubRow } from '~/types/product-catalog'

export type { ProductCatalogHubRow }

function parseCategory(raw: string | undefined): ProductCatalogCategory | undefined {
  if (raw === 'food' || raw === 'beverage' || raw === 'other') return raw
  return undefined
}

const SORT_FIELDS: ProductCatalogHubSortField[] = [
  'name',
  'category',
  'hoofdgroep',
  'productgroep',
  'list_ex',
  'list_inc',
  'vat',
  'sold_qty',
  'sold_revenue',
]

function parseSortField(raw: string | undefined): ProductCatalogHubSortField {
  if (raw && SORT_FIELDS.includes(raw as ProductCatalogHubSortField)) {
    return raw as ProductCatalogHubSortField
  }
  return 'name'
}

function parseSortDir(raw: string | undefined): ProductCatalogHubSortDir {
  if (raw === 'desc') return 'desc'
  return 'asc'
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const skip = Math.max(0, parseInt(String(query.skip ?? '0'), 10) || 0)
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '30'), 10) || 30))
    const search = String(query.search ?? '').trim()
    const locationId = String(query.location ?? '').trim() || undefined
    const category = parseCategory(typeof query.category === 'string' ? query.category : undefined)
    const onlyWithSales =
      query.only_with_sales === '1' || query.only_with_sales === 'true'
    const sortBy = parseSortField(typeof query.sort_by === 'string' ? query.sort_by : undefined)
    const sortDir = parseSortDir(typeof query.sort_dir === 'string' ? query.sort_dir : undefined)
    const range = normalizeProductCatalogDateRange(
      typeof query.start === 'string' ? query.start : undefined,
      typeof query.end === 'string' ? query.end : undefined
    )

    const db = await getDb()
    const [page, venues] = await Promise.all([
      fetchProductCatalogHubPage(db, {
        range,
        skip,
        limit,
        sortBy,
        sortDir,
        search: search || undefined,
        category,
        locationId,
        onlyWithSales,
      }),
      loadProductCatalogVenueOptions(db),
    ])

    return {
      success: true as const,
      data: page.rows,
      range,
      pagination: { skip, limit, total: page.total },
      summary: page.summary,
      venues,
      sort: { by: sortBy, dir: sortDir },
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load product catalog',
    })
  }
})
