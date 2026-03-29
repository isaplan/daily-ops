/**
 * @registry-id: menuVersionsSavePost
 * @created: 2026-02-24T12:00:00.000Z
 * @last-modified: 2026-02-24T12:00:00.000Z
 * @description: POST /api/menu/menus/[id]/versions - save current menu state as version snapshot
 * @exports-to: nuxt-app/pages/daily-menu-products/menu-builder-v2 => Save version
 */
import { ObjectId } from 'mongodb'
import { getMenusCollection, getMenuVersionsCollection } from '../../../../../utils/db'
import type { Menu, MenuSectionV2, MenuSection } from '../../../../../../types/menuItem'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing menu id' })
  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Menu not found' })
  }
  const menusColl = await getMenusCollection()
  const menu = await menusColl.findOne({ _id: oid }) as Menu | null
  if (!menu) throw createError({ statusCode: 404, statusMessage: 'Menu not found' })
  const snapshot: { menuSections?: MenuSection[]; menuSectionsV2?: MenuSectionV2[] } = {}
  if (menu.menuSectionsV2?.length) snapshot.menuSectionsV2 = JSON.parse(JSON.stringify(menu.menuSectionsV2))
  else if (menu.menuSections?.length) snapshot.menuSections = JSON.parse(JSON.stringify(menu.menuSections))
  const versionsColl = await getMenuVersionsCollection()
  const doc = {
    _id: new ObjectId(),
    menuId: id,
    savedAt: new Date().toISOString(),
    snapshot,
  }
  await versionsColl.insertOne(doc)
  return {
    success: true,
    data: { _id: doc._id.toString(), savedAt: doc.savedAt },
  }
})
