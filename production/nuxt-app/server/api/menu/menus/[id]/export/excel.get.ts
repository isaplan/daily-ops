/**
 * @registry-id: menuExcelExport
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: GET /api/menu/menus/[id]/export/excel - export menu to Excel workbook
 * @last-fix: [2026-03-02] Created as part of menu builder restructuring
 * @exports-to:
 * ✓ nuxt-app/pages/daily-menu-products/menu-builder/[id].vue => Exports menu to Excel file
 */
import { ObjectId } from 'mongodb'
import * as XLSX from 'xlsx'
import { getMenusCollection } from '../../../../../utils/db'
import { getMenuItemsCollection } from '../../../../../utils/db'

const SECTION_LABELS: Record<string, string> = {
  drinks: 'Drinks',
  diner: 'Diner',
  snacks: 'Snacks',
  dessert: 'Dessert',
  coursesMenu: 'Courses',
}

function getSectionsForExport(menu: { menuSections?: Array<{ id: string; name: string; productIds: string[] }>; sections?: Record<string, string[]> }): Array<{ name: string; productIds: string[] }> {
  if (menu.menuSections?.length) {
    return menu.menuSections.map((s) => ({ name: s.name, productIds: s.productIds || [] }))
  }
  const leg = menu.sections as Record<string, string[]> | undefined
  if (!leg) return []
  return Object.keys(SECTION_LABELS).map((key) => ({
    name: SECTION_LABELS[key],
    productIds: leg[key] || [],
  }))
}

function productDisplayName(item: { data?: Record<string, unknown>; name?: string }): string {
  if (!item) return '–'
  const d = item.data
  if (d && typeof d === 'object') {
    const keys = ['Product Kinsbergen', 'Product', 'Name', 'name']
    for (const k of keys) {
      const v = d[k]
      if (v !== undefined && v !== null && String(v).trim()) return String(v).trim()
    }
    const first = Object.values(d).find((v) => v != null && String(v).trim())
    if (first != null) return String(first).trim().slice(0, 100)
  }
  return item.name ?? '–'
}

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
  const menu = await menusColl.findOne({ _id: oid })
  if (!menu) throw createError({ statusCode: 404, statusMessage: 'Menu not found' })

  const itemsColl = await getMenuItemsCollection()
  const sectionsForExport = getSectionsForExport(menu)
  const allIds = new Set<string>()
  for (const s of sectionsForExport) {
    for (const id of s.productIds) allIds.add(id)
  }
  const itemsList = allIds.size
    ? await itemsColl.find({ _id: { $in: Array.from(allIds).map((id) => new ObjectId(id)) } }).toArray()
    : []
  const itemsById: Record<string, { data?: Record<string, unknown>; name?: string }> = {}
  for (const doc of itemsList) {
    const sid = doc._id?.toString()
    if (sid) itemsById[sid] = doc
  }

  const rows: string[][] = [['Section', 'Product']]
  for (const s of sectionsForExport) {
    for (const productId of s.productIds) {
      const name = productDisplayName(itemsById[productId] || {})
      rows.push([s.name, name])
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  const sheetName = String((menu.name as string) || 'Menu').slice(0, 31)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(
    event,
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(String(menu.name || 'menu'))}.xlsx"`
  )
  return buf
})
