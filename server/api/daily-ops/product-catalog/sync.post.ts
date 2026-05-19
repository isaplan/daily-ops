/**
 * @registry-id: dailyOpsProductCatalogSyncPost
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Manual refresh of product_catalog from Bork API
 * @last-fix: [2026-05-20] Initial catalog sync endpoint
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/product-catalog.vue
 */

import { getDb } from '../../../utils/db'
import { syncProductCatalogFromBorkApi } from '../../../services/productCatalogService'

export default defineEventHandler(async () => {
  try {
    const db = await getDb()
    const result = await syncProductCatalogFromBorkApi(db)
    return { success: result.ok, ...result }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Product catalog sync failed',
    })
  }
})
