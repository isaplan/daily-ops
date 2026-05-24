/**
 * @registry-id: menuCatalogLinkAutoPost
 * @created: 2026-05-24T00:00:00.000Z
 * @last-modified: 2026-05-24T00:00:00.000Z
 * @description: Auto-link menu_items to product_catalog (match or planned SKU)
 * @last-fix: [2026-05-24] Initial bulk catalog link endpoint
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox/product-catalog.vue
 */

import { getDb } from '../../../utils/db'
import { autoLinkUnmappedMenuItems } from '../../../utils/menuCatalogLink'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => ({}))) as { limit?: number }
  const db = await getDb()
  const result = await autoLinkUnmappedMenuItems(db, { limit: body?.limit })
  return { success: true, ...result }
})
