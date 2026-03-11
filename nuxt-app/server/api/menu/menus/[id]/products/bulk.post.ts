/**
 * @registry-id: menuProductsBulkPost
 * @created: 2026-02-24T12:00:00.000Z
 * @last-modified: 2026-02-24T12:00:00.000Z
 * @description: POST /api/menu/menus/[id]/products/bulk - add productIds to a section or subsection
 * @last-fix: [2026-02-24] Created for V2 bulk add products
 * @exports-to: nuxt-app/pages/daily-menu-products/menu-builder-v2/* => Bulk add products
 */
import { ObjectId } from 'mongodb'
import { getMenusCollection } from '../../../../../utils/db'
import type { Menu, MenuSectionV2, MenuSubsectionV2, MenuSection } from '../../../../../../types/menuItem'

function ensureObjectId(id: string): ObjectId {
  try {
    return new ObjectId(id)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid menu id' })
  }
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing menu id' })
  const oid = ensureObjectId(id)
  const body = await readBody<{ sectionId: string; subsectionId?: string; productIds: string[] }>(event)
  const sectionId = body?.sectionId
  const subsectionId = body?.subsectionId
  const productIds = Array.isArray(body?.productIds) ? body.productIds.filter((x): x is string => typeof x === 'string') : []
  if (!sectionId || productIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'sectionId and non-empty productIds required' })
  }
  const coll = await getMenusCollection()
  const menu = await coll.findOne({ _id: oid }) as Menu | null
  if (!menu) throw createError({ statusCode: 404, statusMessage: 'Menu not found' })
  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (menu.menuSectionsV2?.length) {
    const sections = JSON.parse(JSON.stringify(menu.menuSectionsV2)) as MenuSectionV2[]
    const sec = sections.find((s) => s.id === sectionId)
    if (!sec) throw createError({ statusCode: 400, statusMessage: 'Section not found' })
    if (subsectionId) {
      const sub = sec.subsections?.find((s) => s.id === subsectionId)
      if (!sub) throw createError({ statusCode: 400, statusMessage: 'Subsection not found' })
      const set = new Set(sub.productIds || [])
      for (const pid of productIds) set.add(pid)
      sub.productIds = Array.from(set)
    } else {
      const firstSub = sec.subsections?.[0]
      if (firstSub) {
        const set = new Set(firstSub.productIds || [])
        for (const pid of productIds) set.add(pid)
        firstSub.productIds = Array.from(set)
      } else {
        (sec.subsections as MenuSubsectionV2[]) = [{ id: `sub-${Date.now()}`, name: sec.name, productIds: [...productIds] }]
      }
    }
    updates.menuSectionsV2 = sections
  } else {
    const sections = (JSON.parse(JSON.stringify(menu.menuSections || [])) as MenuSection[])
    const sec = sections.find((s) => s.id === sectionId)
    if (!sec) throw createError({ statusCode: 400, statusMessage: 'Section not found' })
    const set = new Set(sec.productIds || [])
    for (const pid of productIds) set.add(pid)
    sec.productIds = Array.from(set)
    updates.menuSections = sections
  }
  await coll.updateOne({ _id: oid }, { $set: updates })
  return { success: true, added: productIds.length }
})
