/**
 * @registry-id: menuCopyPost
 * @created: 2026-02-24T12:00:00.000Z
 * @last-modified: 2026-02-24T12:00:00.000Z
 * @description: POST /api/menu/menus/copy - create new menu from existing (sets copiedFromMenuId)
 * @exports-to: nuxt-app/pages/daily-menu-products/menu-builder-v2 => Copy menu action
 */
import { ObjectId } from 'mongodb'
import { getMenusCollection } from '../../../utils/db'
import type { Menu, MenuSectionV2, MenuSection } from '../../../../types/menuItem'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ copyFrom: string; name?: string }>(event)
  const copyFrom = body?.copyFrom
  if (!copyFrom || typeof copyFrom !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'copyFrom (menu id) is required' })
  }
  let sourceOid: ObjectId
  try {
    sourceOid = new ObjectId(copyFrom)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Source menu not found' })
  }
  const coll = await getMenusCollection()
  const source = await coll.findOne({ _id: sourceOid }) as Menu | null
  if (!source) {
    throw createError({ statusCode: 404, statusMessage: 'Source menu not found' })
  }
  const now = new Date()
  const newName = typeof body?.name === 'string' && body.name.trim()
    ? body.name.trim()
    : `${source.name} (copy)`
  const doc: Record<string, unknown> = {
    _id: new ObjectId(),
    name: newName,
    startDate: source.startDate,
    location: source.location,
    defaultWastePercent: source.defaultWastePercent,
    defaultMarginMultiplier: source.defaultMarginMultiplier,
    defaultVatRate: source.defaultVatRate,
    copiedFromMenuId: copyFrom,
    createdAt: now,
    updatedAt: now,
  }
  if (source.menuSectionsV2 && source.menuSectionsV2.length > 0) {
    doc.menuSectionsV2 = JSON.parse(JSON.stringify(source.menuSectionsV2)) as MenuSectionV2[]
  } else if (source.menuSections && source.menuSections.length > 0) {
    doc.menuSections = JSON.parse(JSON.stringify(source.menuSections)) as MenuSection[]
  } else {
    doc.menuSections = []
  }
  await coll.insertOne(doc)
  const inserted = doc as { _id: ObjectId; name: string; menuSections?: MenuSection[]; menuSectionsV2?: MenuSectionV2[]; copiedFromMenuId: string; createdAt: Date; updatedAt: Date }
  return {
    success: true,
    data: {
      _id: inserted._id.toString(),
      name: inserted.name,
      menuSections: inserted.menuSections,
      menuSectionsV2: inserted.menuSectionsV2,
      copiedFromMenuId: inserted.copiedFromMenuId,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    },
  }
})
