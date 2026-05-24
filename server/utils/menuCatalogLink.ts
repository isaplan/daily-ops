/**
 * @registry-id: menuCatalogLink
 * @created: 2026-05-24T00:00:00.000Z
 * @last-modified: 2026-05-24T00:00:00.000Z
 * @description: Link menu_items ↔ product_catalog; menu price rollups per catalog SKU
 * @last-fix: [2026-05-24] Initial catalog–menu bridge
 *
 * @exports-to:
 * ✓ server/utils/productCatalog.ts
 * ✓ server/api/menu/catalog-link/auto.post.ts
 * ✓ server/api/menu/items/[id]/catalog-link.patch.ts
 * ✓ server/api/daily-ops/product-catalog.get.ts
 */

import { ObjectId, type Db } from 'mongodb'
import {
  applyCatalogFamilyFields,
  productBrandFingerprint,
} from './productCatalogBrandFamily'
import type { ProductCatalogDoc } from '~/types/product-catalog'
import type {
  Menu,
  MenuItem,
  MenuProductOverride,
  MenuSection,
  MenuSectionV2,
  MenuSubsectionV2,
} from '~/types/menuItem'
import type { ProductCatalogMenuPriceRow } from '~/types/product-catalog'

const CATALOG = 'product_catalog'
const MENU_ITEMS = 'menu_items'
const MENUS = 'menus'
const MENU_VERSIONS = 'menu_versions'

export function plannedCatalogKeyForMenuItem(menuItemId: string): string {
  return `planned:mi:${menuItemId}`
}

export function isPlannedCatalogKey(productKey: string): boolean {
  return productKey.startsWith('planned:')
}

/** Same display logic as Menu Builder product name. */
export function menuItemDisplayName(item: Pick<MenuItem, 'data' | 'name'> | null | undefined): string {
  if (!item) return ''
  const d = item.data
  if (d && typeof d === 'object') {
    for (const k of ['Product Kinsbergen', 'Product', 'Name', 'name', 'Productnaam', 'Omschrijving']) {
      const v = d[k]
      if (v != null && String(v).trim()) return String(v).trim()
    }
    const first = Object.values(d).find((v) => v != null && String(v).trim())
    if (first != null) return String(first).trim().slice(0, 120)
  }
  return String(item.name ?? '').trim()
}

export function catalogVariantsMatch(displayNameA: string, displayNameB: string): boolean {
  const fa = applyCatalogFamilyFields(displayNameA)
  const fb = applyCatalogFamilyFields(displayNameB)
  if (productBrandFingerprint(fa.family_name) !== productBrandFingerprint(fb.family_name)) {
    return false
  }
  if (fa.size_label && fb.size_label && fa.size_label.toLowerCase() !== fb.size_label.toLowerCase()) {
    return false
  }
  return true
}

function guessCategoryFromName(displayName: string): ProductCatalogDoc['category'] {
  const n = displayName.toLowerCase()
  if (/\b(bier|pils|wijn|wine|cola|fanta|sprite|bier|gin|vodka|whisky|rum|coffee|espresso|thee|sap|limonade|radler|moretti|heineken|jupiler)\b/.test(n)) {
    return 'beverage'
  }
  if (/\b(burger|pizza|salade|soep|brood|kaas|vlees|vis|dessert|ijs|patat|friet)\b/.test(n)) {
    return 'food'
  }
  return 'other'
}

function preferLiveCatalogDoc(docs: ProductCatalogDoc[]): ProductCatalogDoc | null {
  if (docs.length === 0) return null
  return docs.find((d) => !isPlannedCatalogKey(d.product_key)) ?? docs[0] ?? null
}

export async function findBestCatalogMatch(db: Db, displayName: string): Promise<ProductCatalogDoc | null> {
  const trimmed = displayName.trim()
  if (!trimmed) return null

  const fields = applyCatalogFamilyFields(trimmed)
  const fp = productBrandFingerprint(fields.family_name)
  if (!fp) return null

  const coll = db.collection<ProductCatalogDoc>(CATALOG)
  const byFamily = await coll
    .find({ family_name: { $regex: new RegExp(`^${escapeRegex(fields.family_name)}$`, 'i') } })
    .limit(200)
    .toArray()

  const byDisplay = byFamily.length
    ? byFamily
    : await coll
        .find({ display_name: { $regex: escapeRegex(fp.split(' ')[0] ?? fp), $options: 'i' } })
        .limit(150)
        .toArray()

  const matched = byDisplay.filter((d) => catalogVariantsMatch(trimmed, d.display_name))
  if (matched.length === 0) return null

  if (fields.size_label) {
    const sized = matched.filter((d) => {
      const ds = applyCatalogFamilyFields(d.display_name).size_label
      return ds && ds.toLowerCase() === fields.size_label!.toLowerCase()
    })
    if (sized.length > 0) return preferLiveCatalogDoc(sized)
  }

  const exact = matched.filter(
    (d) => d.display_name.trim().toLowerCase() === trimmed.toLowerCase()
  )
  if (exact.length > 0) return preferLiveCatalogDoc(exact)

  return preferLiveCatalogDoc(matched)
}

export async function setMenuItemCatalogLink(
  db: Db,
  menuItemId: string,
  catalogProductKey: string | null,
  linkSource: 'auto' | 'manual' = 'manual'
): Promise<void> {
  const coll = db.collection(MENU_ITEMS)
  const update: Record<string, unknown> = {
    updatedAt: new Date(),
    catalogLinkSource: linkSource,
  }
  if (catalogProductKey) {
    update.catalogProductKey = catalogProductKey
  } else {
    update.catalogProductKey = null
    update.catalogLinkSource = null
  }
  if (catalogProductKey) {
    await coll.updateOne({ _id: new ObjectId(menuItemId) }, { $set: update })
  } else {
    await coll.updateOne(
      { _id: new ObjectId(menuItemId) },
      { $set: { updatedAt: update.updatedAt }, $unset: { catalogProductKey: '', catalogLinkSource: '' } }
    )
  }
}

export async function upsertPlannedCatalogFromMenuItem(
  db: Db,
  menuItemId: string,
  displayName: string
): Promise<string> {
  const productKey = plannedCatalogKeyForMenuItem(menuItemId)
  const { family_name, size_label } = applyCatalogFamilyFields(displayName)
  const now = new Date()
  const doc: ProductCatalogDoc = {
    product_key: productKey,
    display_name: displayName,
    family_name,
    size_label,
    category: guessCategoryFromName(displayName),
    hoofdgroep: null,
    sub_category: null,
    vat_percent: 21,
    vat_label: '21',
    location_ids: [],
    locations: [],
    catalog_status: 'planned',
    sources: { menu_item_id: menuItemId },
    updated_at: now,
  }
  await db.collection<ProductCatalogDoc>(CATALOG).updateOne(
    { product_key: productKey },
    { $set: doc },
    { upsert: true }
  )
  return productKey
}

export async function autoLinkMenuItem(
  db: Db,
  item: MenuItem & { _id: ObjectId }
): Promise<{ linked: boolean; product_key: string | null; created_planned: boolean }> {
  const id = item._id.toString()
  const existingKey =
    typeof (item as MenuItem & { catalogProductKey?: string }).catalogProductKey === 'string'
      ? (item as MenuItem & { catalogProductKey?: string }).catalogProductKey!.trim()
      : ''
  if (existingKey) {
    return { linked: true, product_key: existingKey, created_planned: isPlannedCatalogKey(existingKey) }
  }

  const displayName = menuItemDisplayName(item)
  if (!displayName) {
    return { linked: false, product_key: null, created_planned: false }
  }

  const match = await findBestCatalogMatch(db, displayName)
  if (match) {
    await setMenuItemCatalogLink(db, id, match.product_key, 'auto')
    return { linked: true, product_key: match.product_key, created_planned: false }
  }

  const plannedKey = await upsertPlannedCatalogFromMenuItem(db, id, displayName)
  await setMenuItemCatalogLink(db, id, plannedKey, 'auto')
  return { linked: true, product_key: plannedKey, created_planned: true }
}

export type AutoLinkMenuItemsResult = {
  scanned: number
  linked: number
  planned_created: number
  already_linked: number
  skipped_no_name: number
}

export async function autoLinkUnmappedMenuItems(
  db: Db,
  opts?: { limit?: number }
): Promise<AutoLinkMenuItemsResult> {
  const limit = Math.min(5000, Math.max(1, opts?.limit ?? 2000))
  const coll = db.collection<MenuItem & { _id: ObjectId }>(MENU_ITEMS)
  const items = await coll
    .find({
      $or: [{ catalogProductKey: { $exists: false } }, { catalogProductKey: null }, { catalogProductKey: '' }],
    })
    .limit(limit)
    .toArray()

  const result: AutoLinkMenuItemsResult = {
    scanned: items.length,
    linked: 0,
    planned_created: 0,
    already_linked: 0,
    skipped_no_name: 0,
  }

  for (const item of items) {
    const name = menuItemDisplayName(item)
    if (!name) {
      result.skipped_no_name++
      continue
    }
    const r = await autoLinkMenuItem(db, item)
    if (r.linked) {
      result.linked++
      if (r.created_planned) result.planned_created++
    }
  }

  return result
}

/** When Bork sync adds a live SKU, merge matching planned catalog + re-point menu_items. */
export async function adoptPlannedCatalogForBorkProduct(
  db: Db,
  borkProductKey: string,
  displayName: string
): Promise<number> {
  const coll = db.collection<ProductCatalogDoc>(CATALOG)
  const planned = await coll.find({ product_key: /^planned:/ }).toArray()
  let migrated = 0

  for (const p of planned) {
    if (!catalogVariantsMatch(displayName, p.display_name)) continue

    await db.collection(MENU_ITEMS).updateMany(
      { catalogProductKey: p.product_key },
      { $set: { catalogProductKey: borkProductKey, catalogLinkSource: 'auto', updatedAt: new Date() } }
    )
    await coll.deleteOne({ product_key: p.product_key })
    migrated++
  }

  return migrated
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readOverridePrice(ov: MenuProductOverride | undefined, item: MenuItem): number | null {
  if (ov?.menuPriceIncVat != null && Number.isFinite(ov.menuPriceIncVat)) return ov.menuPriceIncVat
  const d = item.data
  if (d && typeof d === 'object') {
    for (const k of ['Bruto Kaartprijs', 'Bruto Calculatie Prijs', 'Menu Price', 'Prijs', 'priceIncVat']) {
      const v = d[k]
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  if (item.priceIncVat != null && item.priceIncVat > 0) return item.priceIncVat
  return null
}

function readOverrideCost(ov: MenuProductOverride | undefined, item: MenuItem): number | null {
  if (ov?.costPerItem != null && Number.isFinite(ov.costPerItem)) return ov.costPerItem
  if (ov?.batchCost != null && ov?.itemsPerBatch != null && ov.itemsPerBatch > 0) {
    return ov.batchCost / ov.itemsPerBatch
  }
  if (item.costPricePerItem != null && item.costPricePerItem > 0) return item.costPricePerItem
  if (item.costPerPieceAfterWaste != null && item.costPerPieceAfterWaste > 0) return item.costPerPieceAfterWaste
  return null
}

function marginPercent(priceInc: number | null, cost: number | null, vatRate = 21): number | null {
  if (priceInc == null || cost == null || priceInc <= 0 || cost < 0) return null
  const net = priceInc / (1 + vatRate / 100)
  if (net <= 0) return null
  return Math.round(((net - cost) / net) * 1000) / 10
}

type WalkCtx = {
  productId: string
  overrides?: MenuProductOverride
}

function walkMenuSections(
  menu: Menu & { _id?: ObjectId },
  visit: (ctx: WalkCtx) => void
): void {
  const menuId = menu._id?.toString() ?? ''

  if (menu.menuSectionsV2?.length) {
    for (const sec of menu.menuSectionsV2 as MenuSectionV2[]) {
      for (const sub of sec.subsections ?? []) {
        for (const pid of sub.productIds ?? []) {
          visit({ productId: pid, overrides: sub.productOverrides?.[pid] })
        }
      }
    }
    return
  }

  if (menu.menuSections?.length) {
    for (const sec of menu.menuSections as MenuSection[]) {
      for (const pid of sec.productIds ?? []) {
        visit({ productId: pid, overrides: sec.productOverrides?.[pid] })
      }
    }
  }

  void menuId
}

function walkVersionSnapshot(
  menuId: string,
  menuName: string,
  savedAt: Date | string | undefined,
  snapshot: { menuSections?: MenuSection[]; menuSectionsV2?: MenuSectionV2[] },
  visit: (ctx: WalkCtx & { source: 'menu_version'; version_saved_at: string }) => void
): void {
  const version_saved_at =
    savedAt instanceof Date ? savedAt.toISOString() : String(savedAt ?? '')

  if (snapshot.menuSectionsV2?.length) {
    for (const sec of snapshot.menuSectionsV2) {
      for (const sub of sec.subsections ?? []) {
        for (const pid of sub.productIds ?? []) {
          visit({
            productId: pid,
            overrides: sub.productOverrides?.[pid],
            source: 'menu_version',
            version_saved_at,
          })
        }
      }
    }
    return
  }

  if (snapshot.menuSections?.length) {
    for (const sec of snapshot.menuSections) {
      for (const pid of sec.productIds ?? []) {
        visit({
          productId: pid,
          overrides: sec.productOverrides?.[pid],
          source: 'menu_version',
          version_saved_at,
        })
      }
    }
  }

  void menuId
  void menuName
}

export async function loadMenuPricesForCatalogKeys(
  db: Db,
  productKeys: string[]
): Promise<Map<string, ProductCatalogMenuPriceRow[]>> {
  const out = new Map<string, ProductCatalogMenuPriceRow[]>()
  if (productKeys.length === 0) return out

  const keySet = new Set(productKeys)
  for (const k of productKeys) out.set(k, [])

  const menuItems = await db
    .collection<MenuItem & { _id: ObjectId; catalogProductKey?: string }>(MENU_ITEMS)
    .find({ catalogProductKey: { $in: productKeys } })
    .toArray()

  const itemById = new Map<string, MenuItem & { _id: ObjectId; catalogProductKey?: string }>()
  for (const item of menuItems) {
    itemById.set(item._id.toString(), item)
  }

  const append = (catalogKey: string, row: ProductCatalogMenuPriceRow) => {
    if (!keySet.has(catalogKey)) return
    const list = out.get(catalogKey) ?? []
    list.push(row)
    out.set(catalogKey, list)
  }

  const buildRow = (
    menu: Menu & { _id?: ObjectId },
    productId: string,
    overrides: MenuProductOverride | undefined,
    extra: Partial<ProductCatalogMenuPriceRow>
  ): void => {
    const item = itemById.get(productId)
    const catalogKey = item?.catalogProductKey
    if (!catalogKey || !keySet.has(catalogKey)) return

    const priceInc = readOverridePrice(overrides, item)
    const cost = readOverrideCost(overrides, item)
    const vat = overrides?.vatRate ?? item?.vatRate ?? 21

    append(catalogKey, {
      menu_id: menu._id?.toString() ?? '',
      menu_name: menu.name,
      menu_item_id: productId,
      menu_item_name: overrides?.displayName?.trim() || menuItemDisplayName(item),
      price_inc_vat: priceInc,
      cost_per_item: cost,
      margin_percent: marginPercent(priceInc, cost, vat === 9 ? 9 : 21),
      effective_date: menu.startDate ?? null,
      source: extra.source ?? 'menu',
      version_saved_at: extra.version_saved_at,
    })
  }

  const menus = await db.collection<Menu & { _id: ObjectId }>(MENUS).find({}).toArray()
  for (const menu of menus) {
    walkMenuSections(menu, ({ productId, overrides }) => {
      buildRow(menu, productId, overrides, { source: 'menu' })
    })
  }

  const versions = await db
    .collection<{
      menuId: string
      savedAt?: Date
      snapshot?: { menuSections?: MenuSection[]; menuSectionsV2?: MenuSectionV2[] }
    }>(MENU_VERSIONS)
    .find({})
    .sort({ savedAt: -1 })
    .limit(500)
    .toArray()

  const menuNameById = new Map(menus.map((m) => [m._id.toString(), m.name]))

  for (const ver of versions) {
    const snap = ver.snapshot
    if (!snap) continue
    const menuName = menuNameById.get(String(ver.menuId)) ?? 'Menu version'
    const pseudoMenu = { _id: new ObjectId(String(ver.menuId)), name: menuName } as Menu & { _id: ObjectId }
    walkVersionSnapshot(String(ver.menuId), menuName, ver.savedAt, snap, (ctx) => {
      buildRow(pseudoMenu, ctx.productId, ctx.overrides, {
        source: 'menu_version',
        version_saved_at: ctx.version_saved_at,
      })
    })
  }

  return out
}
