/**
 * @registry-id: dailyOpsProductCatalogGet
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Unified product_catalog hub — menu + last-N-day sales per variant row
 * @last-fix: [2026-05-20] only_with_sales filter; sellable catalog rows only
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/product-catalog.vue
 */

import { getDb } from '../../utils/db'
import {
  fetchProductCatalogHubRows,
  normalizeProductCatalogDateRange,
} from '../../utils/productCatalog'
import type { ProductCatalogCategory, ProductCatalogHubRow } from '~/types/product-catalog'

export type { ProductCatalogHubRow }

function parseCategory(raw: string | undefined): ProductCatalogCategory | undefined {
  if (raw === 'food' || raw === 'beverage' || raw === 'other') return raw
  return undefined
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const skip = Math.max(0, parseInt(String(query.skip ?? '0'), 10) || 0)
    const limit = Math.min(200, Math.max(1, parseInt(String(query.limit ?? '50'), 10) || 50))
    const search = String(query.search ?? '').trim()
    const locationId = String(query.location ?? '').trim() || undefined
    const category = parseCategory(typeof query.category === 'string' ? query.category : undefined)
    const onlyWithSales =
      query.only_with_sales === '1' || query.only_with_sales === 'true'
    const range = normalizeProductCatalogDateRange(
      typeof query.start === 'string' ? query.start : undefined,
      typeof query.end === 'string' ? query.end : undefined
    )

    const db = await getDb()
    const { rows: allRows, catalog_count } = await fetchProductCatalogHubRows(db, {
      range,
      search: search || undefined,
      category,
      locationId,
      onlyWithSales,
    })

    const withSales = allRows.filter((r) => r.sold_quantity > 0).length
    const categories = {
      food: allRows.filter((r) => r.category === 'food').length,
      beverage: allRows.filter((r) => r.category === 'beverage').length,
      other: allRows.filter((r) => r.category === 'other').length,
    }
    const distinctFamilies = new Set(allRows.map((r) => r.family_name)).size

    const page = allRows.slice(skip, skip + limit)

    return {
      success: true as const,
      data: page,
      range,
      pagination: { skip, limit, total: allRows.length },
      summary: {
        catalog_count,
        listed: allRows.length,
        with_sales: withSales,
        distinct_families: distinctFamilies,
        categories,
      },
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load product catalog',
    })
  }
})
