/**
 * @registry-id: menuItemCatalogLinkPatch
 * @created: 2026-05-24T00:00:00.000Z
 * @last-modified: 2026-05-24T00:00:00.000Z
 * @description: Manual link menu_item ↔ product_catalog.product_key
 * @last-fix: [2026-05-24] Initial manual catalog link endpoint
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../../../../utils/db'
import {
  findBestCatalogMatch,
  menuItemDisplayName,
  setMenuItemCatalogLink,
  upsertPlannedCatalogFromMenuItem,
} from '../../../../utils/menuCatalogLink'
import type { MenuItem } from '../../../../../types/menuItem'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid menu item id' })
  }

  const body = (await readBody(event)) as { catalogProductKey?: string | null; auto?: boolean }
  const db = await getDb()
  const coll = db.collection<MenuItem & { _id: ObjectId }>('menu_items')
  const item = await coll.findOne({ _id: new ObjectId(id) })
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Menu item not found' })
  }

  if (body?.auto) {
    const name = menuItemDisplayName(item)
    const match = name ? await findBestCatalogMatch(db, name) : null
    if (match) {
      await setMenuItemCatalogLink(db, id, match.product_key, 'manual')
      return { success: true, catalogProductKey: match.product_key, matched: true }
    }
    const plannedKey = await upsertPlannedCatalogFromMenuItem(db, id, name || `Menu item ${id}`)
    await setMenuItemCatalogLink(db, id, plannedKey, 'manual')
    return { success: true, catalogProductKey: plannedKey, matched: false, planned: true }
  }

  const key =
    body?.catalogProductKey === null || body?.catalogProductKey === ''
      ? null
      : String(body?.catalogProductKey ?? '').trim()

  if (key) {
    const catalog = await db.collection('product_catalog').findOne({ product_key: key })
    if (!catalog) {
      throw createError({ statusCode: 404, statusMessage: 'Catalog product not found' })
    }
    await setMenuItemCatalogLink(db, id, key, 'manual')
    return { success: true, catalogProductKey: key }
  }

  await setMenuItemCatalogLink(db, id, null, 'manual')
  return { success: true, catalogProductKey: null }
})
