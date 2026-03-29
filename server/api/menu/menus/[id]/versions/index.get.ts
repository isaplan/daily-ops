/**
 * @registry-id: menuVersionsListGet
 * @created: 2026-02-24T12:00:00.000Z
 * @last-modified: 2026-02-24T12:00:00.000Z
 * @description: GET /api/menu/menus/[id]/versions - list version snapshots for menu
 * @exports-to: nuxt-app/pages/daily-menu-products/menu-builder-v2 => Version history
 */
import { ObjectId } from 'mongodb'
import { getMenuVersionsCollection } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing menu id' })
  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Menu not found' })
  }
  const coll = await getMenuVersionsCollection()
  const list = await coll
    .find({ menuId: id })
    .sort({ savedAt: -1 })
    .limit(50)
    .project({ _id: 1, savedAt: 1 })
    .toArray()
  const data = list.map((d) => ({
    _id: (d as { _id: ObjectId })._id?.toString(),
    savedAt: (d as { savedAt: string }).savedAt,
  }))
  return { success: true, data }
})
