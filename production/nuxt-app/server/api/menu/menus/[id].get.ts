/**
 * @registry-id: menuByIdGet
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: GET /api/menu/menus/[id] - fetch single menu by ID
 * @last-fix: [2026-03-02] Created as part of menu builder restructuring
 * @exports-to:
 * ✓ nuxt-app/pages/daily-menu-products/menu-builder/[id].vue => Fetches menu details
 */
import { ObjectId } from 'mongodb'
import { getMenusCollection } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing menu id' })
  }
  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Menu not found' })
  }
  const coll = await getMenusCollection()
  const doc = await coll.findOne({ _id: oid })
  if (!doc) {
    return { success: true, data: null }
  }
  const { _id, ...rest } = doc
  return { success: true, data: { _id: _id?.toString(), ...rest } }
})
