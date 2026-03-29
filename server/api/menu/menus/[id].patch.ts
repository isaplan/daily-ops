/**
 * @registry-id: menuByIdPatch
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: PATCH /api/menu/menus/[id] - update menu sections and settings
 * @last-fix: [2026-03-02] Created as part of menu builder restructuring
 * @exports-to:
 * ✓ nuxt-app/pages/daily-menu-products/menu-builder/[id].vue => Updates menu data
 */
import { ObjectId } from 'mongodb'
import { getMenusCollection } from '../../../utils/db'
import type { MenuSection } from '../../../../types/menuItem'

function isMenuSectionArray(v: unknown): v is MenuSection[] {
  return Array.isArray(v) && v.every(
    (x) => x && typeof x.id === 'string' && typeof x.name === 'string' && Array.isArray(x.productIds)
  )
}

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
  const body = await readBody<{
    menuSections?: MenuSection[]
    name?: string
    startDate?: string
    location?: string
    defaultWastePercent?: number
    defaultMarginMultiplier?: number
    defaultVatRate?: 9 | 21
  }>(event)
  const now = new Date()
  const coll = await getMenusCollection()
  const updates: Record<string, unknown> = { updatedAt: now }
  if (body?.menuSections !== undefined) {
    if (!isMenuSectionArray(body.menuSections)) {
      throw createError({ statusCode: 400, statusMessage: 'menuSections must be array of { id, name, productIds }' })
    }
    updates.menuSections = body.menuSections
  }
  if (typeof body?.name === 'string') updates.name = body.name.trim()
  if (body?.startDate !== undefined) updates.startDate = body.startDate ? String(body.startDate).trim() : null
  if (body?.location !== undefined) updates.location = body.location ? String(body.location).trim() : null
  if (body?.defaultWastePercent !== undefined) updates.defaultWastePercent = body.defaultWastePercent
  if (body?.defaultMarginMultiplier !== undefined) updates.defaultMarginMultiplier = body.defaultMarginMultiplier
  if (body?.defaultVatRate !== undefined) updates.defaultVatRate = body.defaultVatRate

  const result = await coll.findOneAndUpdate(
    { _id: oid },
    { $set: updates },
    { returnDocument: 'after' }
  )
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Menu not found' })
  }
  const doc = result as { _id: ObjectId; name: string; menuSections: MenuSection[]; updatedAt: Date }
  return {
    success: true,
    data: {
      _id: doc._id?.toString(),
      name: doc.name,
      menuSections: doc.menuSections,
      updatedAt: doc.updatedAt,
    },
  }
})
