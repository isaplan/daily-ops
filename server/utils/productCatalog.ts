/**
 * @registry-id: productCatalog
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Unified product_catalog hub — Bork API catalog + sales rollups
 * @last-fix: [2026-05-24] Brand clustering for all products via productCatalogBrandFamily
 *
 * @exports-to:
 * ✓ server/services/productCatalogService.ts
 * ✓ server/api/daily-ops/product-catalog.get.ts
 * ✓ server/api/daily-ops/product-catalog/sync.post.ts
 */

import { ObjectId, type Db } from 'mongodb'
import { addCalendarDaysYmd, calendarYmdInAmsterdam } from '~/utils/dailyOpsBusinessDate'
import { listBorkAggReadSuffixCandidates } from './borkAggVersionSuffix'
import type {
  ProductCatalogCategory,
  ProductCatalogDateRange,
  ProductCatalogDoc,
  ProductCatalogHubRow,
  ProductCatalogLocationRow,
  ProductCatalogVatLabel,
} from '~/types/product-catalog'
import {
  applyCatalogFamilyFields,
} from './productCatalogBrandFamily'
import { adoptPlannedCatalogForBorkProduct, loadMenuPricesForCatalogKeys } from './menuCatalogLink'

const COLLECTION = 'product_catalog'

export function normalizeCatalogLocationId(id: unknown): string {
  if (id instanceof ObjectId) return id.toString()
  const s = String(id ?? '').trim()
  if (s && ObjectId.isValid(s)) return new ObjectId(s).toString()
  return s
}

/** Bork group names that are operational, not guest menu products. */
const NON_SELLABLE_GROUP = /^melding$/i

export function isMeldingGroupName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim()
  if (!n) return false
  return NON_SELLABLE_GROUP.test(n)
}

/** Bork group path aligned with registry export (Winkel → Hoofdgroep → Productgroep → Product). */
export type BorkGroupCatalogPath = {
  ancestors: BorkGroupRow[]
  hoofdgroep: string | null
  productgroep: string | null
  leafGroupName: string | null
  pathNames: string[]
}

const BEVERAGE_GROUP_HINT =
  /bierboetiek|bier\s*boetiek|(^|\s)dranken\b|speciaalbier|tap\s|wijnen|cocktail|alcohol\s+vrij|fles\s+speciaalbier/i

export function classifyCategoryFromHoofdgroep(
  hoofdgroep: string | null,
  context?: {
    productgroep?: string | null
    leafGroupName?: string | null
    pathNames?: string[]
  }
): ProductCatalogCategory {
  const h = (hoofdgroep ?? '').trim().toLowerCase()
  if (/^dranken\s+(hoog|laag)$/.test(h)) return 'beverage'
  if (h === 'bierboetiek' || h === 'bier boetiek') return 'beverage'
  if (h === 'keuken') return 'food'
  if (h === 'non-food') return 'other'

  const hints = [
    context?.productgroep,
    context?.leafGroupName,
    ...(context?.pathNames ?? []),
  ]
    .filter((n): n is string => Boolean(n?.trim()))
    .join(' ')
    .toLowerCase()
  if (hints && BEVERAGE_GROUP_HINT.test(hints)) return 'beverage'
  if (hints && /\bkeuken\b/.test(hints)) return 'food'

  return 'other'
}

export function classifyCategoryFromBorkGroupPath(path: BorkGroupCatalogPath): ProductCatalogCategory {
  return classifyCategoryFromHoofdgroep(path.hoofdgroep, {
    productgroep: path.productgroep,
    leafGroupName: path.leafGroupName,
    pathNames: path.pathNames,
  })
}

export function classifyCategoryFromCatalogFields(
  hoofdgroep: string | null,
  sub_category: string | null
): ProductCatalogCategory {
  return classifyCategoryFromHoofdgroep(hoofdgroep, { productgroep: sub_category })
}

export function resolveBorkGroupCatalogPath(
  groups: BorkGroupRow[],
  productGroupKey: string | null
): BorkGroupCatalogPath {
  if (!productGroupKey) {
    return { ancestors: [], hoofdgroep: null, productgroep: null, leafGroupName: null, pathNames: [] }
  }
  const leaf = groups.find((g) => groupKeyString(g.Key) === productGroupKey)
  if (!leaf || leaf.LeftNr == null || leaf.RightNr == null) {
    const name = leaf?.Name ?? null
    return {
      ancestors: leaf ? [leaf] : [],
      hoofdgroep: null,
      productgroep: name,
      leafGroupName: name,
      pathNames: name ? [name] : [],
    }
  }
  const ancestors = groups
    .filter(
      (o) =>
        o.LeftNr != null &&
        o.RightNr != null &&
        o.LeftNr <= leaf.LeftNr! &&
        o.RightNr >= leaf.RightNr!
    )
    .sort((a, b) => (a.GroupLevel ?? 0) - (b.GroupLevel ?? 0))
  const pathNames = ancestors.map((a) => a.Name).filter((n): n is string => Boolean(n))
  const hoofdgroep = ancestors.find((a) => a.GroupLevel === 2)?.Name ?? null
  const level3 = ancestors.find((a) => a.GroupLevel === 3)
  const leafLevel = leaf.GroupLevel ?? 0
  let productgroep: string | null = leaf.Name ?? null
  if (leafLevel >= 4 && level3?.Name) {
    productgroep = level3.Name
  } else if (leafLevel === 3) {
    productgroep = leaf.Name ?? null
  }
  return {
    ancestors,
    hoofdgroep,
    productgroep,
    leafGroupName: leaf.Name ?? null,
    pathNames,
  }
}

/** Sellable menu SKU: mapped 21/6% VAT and not under Melding. */
export function isSellableCatalogProduct(input: {
  vatPercent: 21 | 6 | null
  groupPath: BorkGroupCatalogPath
}): boolean {
  if (input.vatPercent == null) return false
  if (isMeldingGroupName(input.groupPath.productgroep)) return false
  if (isMeldingGroupName(input.groupPath.leafGroupName)) return false
  return !input.groupPath.ancestors.some((a) => isMeldingGroupName(a.Name))
}

export function isSellableCatalogDoc(doc: ProductCatalogDoc): boolean {
  if (doc.vat_percent == null) return false
  if (isMeldingGroupName(doc.sub_category) || isMeldingGroupName(doc.hoofdgroep)) return false
  return true
}

export function hasMeaningfulCatalogName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim()
  if (!n) return false
  if (/^unknown$/i.test(n)) return false
  if (/^[\s\-–—−]+$/.test(n)) return false
  if (/^[-–—−]{2,}$/.test(n)) return false
  return true
}

/** Bork product_key (strips virtual @cluster suffix used in hub UI). */
export function catalogSourceProductKey(productKey: string): string {
  const at = productKey.indexOf('@')
  return at >= 0 ? productKey.slice(0, at) : productKey
}

function locationMenuClusterKey(loc: ProductCatalogLocationRow): string {
  const hg = (loc.hoofdgroep ?? '').trim().toLowerCase()
  const pg = (loc.sub_category ?? '').trim().toLowerCase()
  const vat = loc.vat_percent ?? 'none'
  return `${hg}|${pg}|${vat}`
}

export function catalogDocHasListPrice(doc: Pick<ProductCatalogDoc, 'locations'>): boolean {
  return (doc.locations ?? []).some(
    (l) => l.list_price_inc_vat != null && l.list_price_inc_vat > 0
  )
}

export function hubRowHasListPrice(row: ProductCatalogHubRow): boolean {
  return row.locations.some((l) => l.list_price_inc_vat != null && l.list_price_inc_vat > 0)
}

export function hubRowHasSales(row: ProductCatalogHubRow): boolean {
  return (
    row.sold_quantity > 0 || row.sold_revenue_inc_vat > 0 || row.sold_revenue_ex_vat > 0
  )
}

/** Hub UI + calculations: skip rows without a menu list price. */
export function isExcludedCatalogForCalculations(
  doc: Pick<ProductCatalogDoc, 'display_name' | 'locations'>,
  soldQuantity = 0
): boolean {
  if (catalogDocHasListPrice(doc)) return false
  if (hasMeaningfulCatalogName(doc.display_name)) return true
  return soldQuantity <= 0
}

export function isHiddenCatalogHubRow(row: ProductCatalogHubRow): boolean {
  if (!hasMeaningfulCatalogName(row.display_name)) return true
  if (!hubRowHasSales(row)) return true
  return isExcludedCatalogForCalculations(row, row.sold_quantity)
}

/** $lookup stages: only match catalog rows usable for food/bev classification. */
export const PRODUCT_CATALOG_LOOKUP_PIPELINE = [
  { $match: { $expr: { $eq: ['$product_key', '$$pid'] } } },
  {
    $match: {
      display_name: { $exists: true, $nin: ['', 'Unknown', 'unknown'] },
      locations: { $elemMatch: { list_price_inc_vat: { $gt: 0 } } },
    },
  },
  { $project: { category: 1 } },
] as const

type BorkGroupRow = {
  Key?: string
  Name?: string
  GroupLevel?: number
  LeftNr?: number
  RightNr?: number
}

type BorkProductRow = {
  Key?: string
  Name?: string
  Price?: number
  Vat?: number
  GroupKey?: string
}

type SalesLocBucket = {
  location_id: string
  location_name: string
  unit_price: number
  quantity: number
  revenue_inc: number
  revenue_ex: number
}

function withBrandFamily(doc: ProductCatalogDoc): ProductCatalogDoc {
  const { family_name, size_label } = applyCatalogFamilyFields(doc.display_name)
  return { ...doc, family_name, size_label }
}

export function resolveCatalogVatPercent(vatCode: number): 21 | 6 | null {
  if (!Number.isFinite(vatCode) || vatCode <= 0) return null
  if (vatCode >= 20) return 21
  if (vatCode <= 10) return 6
  return null
}

export function vatLabelFromPercent(pct: 21 | 6 | null): ProductCatalogVatLabel {
  if (pct === 21) return '21'
  if (pct === 6) return '6'
  return 'unknown'
}

export function priceExFromInc(inc: number, vatPercent: 21 | 6 | null): number | null {
  if (!Number.isFinite(inc) || inc <= 0 || vatPercent == null) return null
  return Math.round((inc / (1 + vatPercent / 100)) * 100) / 100
}

function extractRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    for (const v of Object.values(payload as Record<string, unknown>)) {
      if (Array.isArray(v)) return v
    }
  }
  return []
}

function groupKeyString(key: unknown): string | null {
  if (key == null) return null
  if (typeof key === 'string' || typeof key === 'number') return String(key)
  if (typeof key === 'object' && key !== null && 'Key' in key) {
    return String((key as { Key?: unknown }).Key ?? '')
  }
  return null
}

export function buildGroupIndex(groups: unknown[]): {
  rows: BorkGroupRow[]
  byKey: Map<string, BorkGroupRow>
  ancestorNames: (groupKey: string | null) => string[]
  resolvePath: (groupKey: string | null) => BorkGroupCatalogPath
} {
  const rows = groups.filter((g): g is BorkGroupRow => !!g && typeof g === 'object')
  const byKey = new Map<string, BorkGroupRow>()
  for (const g of rows) {
    const k = groupKeyString(g.Key)
    if (k) byKey.set(k, g)
  }

  const resolvePath = (groupKey: string | null) => resolveBorkGroupCatalogPath(rows, groupKey)
  const ancestorNames = (groupKey: string | null) => resolvePath(groupKey).pathNames

  return { rows, byKey, ancestorNames, resolvePath }
}

export async function fetchBorkCatalogJson(
  baseUrl: string,
  apiKey: string,
  path: string
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const base = baseUrl.replace(/\/$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  const url = `${base}${normalized}?appid=${encodeURIComponent(apiKey)}`
  try {
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
    const text = await res.text()
    let data: unknown = text
    try {
      data = text ? (JSON.parse(text) as unknown) : null
    } catch {
      // keep text
    }
    if (res.ok) return { ok: true, status: res.status, data }
    return { ok: false, status: res.status, data: null, error: `HTTP ${res.status}` }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function upsertBorkMasterRaw(
  db: Db,
  locationId: unknown,
  lid: string,
  endpoint: string,
  syncSuffix: string,
  payload: unknown
): Promise<void> {
  const syncDedupKey = `${lid}:${syncSuffix}`
  const records = extractRecords(payload)
  const toStore = records.length > 0 ? records : payload
  const upsertDate = new Date()
  await db.collection('bork_raw_data').updateOne(
    { syncDedupKey },
    {
      $set: {
        endpoint,
        locationId,
        date: upsertDate,
        rawApiResponse: toStore,
        syncDedupKey,
        recordCount: Array.isArray(toStore) ? toStore.length : 1,
        updatedAt: upsertDate,
      },
      $setOnInsert: { createdAt: upsertDate },
    },
    { upsert: true }
  )
}

async function resolveLocationName(
  db: Db,
  locationId: string,
  fallback?: string
): Promise<string> {
  if (fallback?.trim()) return fallback.trim()
  try {
    const oid = new ObjectId(locationId)
    const loc = await db.collection('locations').findOne(
      { _id: oid },
      { projection: { name: 1 } }
    )
    if (loc?.name && typeof loc.name === 'string') return loc.name
  } catch {
    // not ObjectId
  }
  const mapped = await db.collection('bork_unified_location_mapping').findOne({
    $or: [{ unifiedLocationId: locationId }, { locationId }],
  })
  if (mapped?.unifiedLocationName && typeof mapped.unifiedLocationName === 'string') {
    return mapped.unifiedLocationName
  }
  return locationId
}

function locationVenueKey(locationId: string, locationName: string): string {
  const name = locationName.trim().toLowerCase()
  if (name) return `venue:${name}`
  const id = normalizeCatalogLocationId(locationId)
  return id ? `id:${id}` : 'venue:unknown'
}

function mergeLocationFieldsInto(
  target: ProductCatalogLocationRow,
  source: ProductCatalogLocationRow
): void {
  const sourceId = normalizeCatalogLocationId(source.location_id)
  if (sourceId && ObjectId.isValid(sourceId)) target.location_id = sourceId
  if (source.location_name.trim()) target.location_name = source.location_name.trim()

  target.sold_quantity += source.sold_quantity
  target.sold_revenue_inc_vat += source.sold_revenue_inc_vat
  target.sold_revenue_ex_vat += source.sold_revenue_ex_vat

  const sourceHasList =
    source.list_price_inc_vat != null && source.list_price_inc_vat > 0
  if (sourceHasList) {
    target.list_price_inc_vat = source.list_price_inc_vat
    target.list_price_ex_vat = source.list_price_ex_vat
    target.vat_percent = source.vat_percent
    target.vat_label = source.vat_label
    if (source.group_key) target.group_key = source.group_key
    if (source.group_name) target.group_name = source.group_name
    if (source.hoofdgroep) target.hoofdgroep = source.hoofdgroep
    if (source.sub_category) target.sub_category = source.sub_category
    if (source.category !== 'other') target.category = source.category
  }

  if (source.sold_unit_price_inc_vat != null && source.sold_unit_price_inc_vat > 0) {
    target.sold_unit_price_inc_vat = source.sold_unit_price_inc_vat
  }
  if (!target.hoofdgroep && source.hoofdgroep) target.hoofdgroep = source.hoofdgroep
  if (!target.sub_category && source.sub_category) target.sub_category = source.sub_category
  if (target.category === 'other' && source.category !== 'other') target.category = source.category
}

function dedupeLocationRows(locations: ProductCatalogLocationRow[]): ProductCatalogLocationRow[] {
  const byVenue = new Map<string, ProductCatalogLocationRow>()
  for (const loc of locations) {
    const id = normalizeCatalogLocationId(loc.location_id)
    const normalized = { ...loc, location_id: id }
    const key = locationVenueKey(id, normalized.location_name)
    const existing = byVenue.get(key)
    if (!existing) {
      byVenue.set(key, normalized)
      continue
    }
    mergeLocationFieldsInto(existing, normalized)
  }
  return [...byVenue.values()].sort((a, b) => a.location_name.localeCompare(b.location_name, 'nl'))
}

function mergeLocationRow(
  existing: ProductCatalogLocationRow[],
  row: ProductCatalogLocationRow
): ProductCatalogLocationRow[] {
  const rowId = normalizeCatalogLocationId(row.location_id)
  return dedupeLocationRows([...existing, { ...row, location_id: rowId }])
}

/** One bucket per venue — sales agg splits rows by unit price. */
function collapseSalesBucketsByLocation(buckets: SalesLocBucket[]): SalesLocBucket[] {
  const byVenue = new Map<string, SalesLocBucket>()
  for (const b of buckets) {
    const locId = normalizeCatalogLocationId(b.location_id)
    const key = locationVenueKey(locId, b.location_name)
    const existing = byVenue.get(key)
    if (!existing) {
      byVenue.set(key, { ...b, location_id: locId })
      continue
    }
    existing.quantity += b.quantity
    existing.revenue_inc += b.revenue_inc
    existing.revenue_ex += b.revenue_ex
    if (b.unit_price > 0) existing.unit_price = b.unit_price
  }
  return [...byVenue.values()]
}

function pickPrimaryCategory(locations: ProductCatalogLocationRow[]): ProductCatalogCategory {
  const order: ProductCatalogCategory[] = ['beverage', 'food', 'other']
  for (const cat of order) {
    if (locations.some((l) => l.category === cat)) return cat
  }
  return 'other'
}

function pickPrimaryHoofdgroep(locations: ProductCatalogLocationRow[]): string | null {
  const counts = new Map<string, number>()
  for (const l of locations) {
    if (!l.hoofdgroep) continue
    counts.set(l.hoofdgroep, (counts.get(l.hoofdgroep) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [name, n] of counts) {
    if (n > bestN) {
      best = name
      bestN = n
    }
  }
  return best
}

function pickPrimarySubCategory(locations: ProductCatalogLocationRow[]): string | null {
  const counts = new Map<string, number>()
  for (const l of locations) {
    if (!l.sub_category) continue
    counts.set(l.sub_category, (counts.get(l.sub_category) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [name, n] of counts) {
    if (n > bestN) {
      best = name
      bestN = n
    }
  }
  return best
}

export async function upsertCatalogProductFromApi(
  db: Db,
  product: BorkProductRow,
  ctx: {
    locationId: string
    locationName: string
    groupIndex: ReturnType<typeof buildGroupIndex>
    syncedAt: Date
  }
): Promise<void> {
  const productKey = groupKeyString(product.Key)
  if (!productKey) return

  const displayName = String(product.Name ?? '').trim()
  if (!hasMeaningfulCatalogName(displayName)) return

  const groupKey = groupKeyString(product.GroupKey)
  const groupPath = ctx.groupIndex.resolvePath(groupKey)
  const category = classifyCategoryFromBorkGroupPath(groupPath)
  const vatPercent = resolveCatalogVatPercent(Number(product.Vat ?? 0))
  if (!isSellableCatalogProduct({ vatPercent, groupPath })) {
    return
  }

  const listInc = Number(product.Price ?? 0)
  const listIncRounded = Number.isFinite(listInc) && listInc > 0 ? Math.round(listInc * 100) / 100 : null
  const storedName = displayName
  const listEx = listIncRounded != null ? priceExFromInc(listIncRounded, vatPercent) : null

  const locRow: ProductCatalogLocationRow = {
    location_id: normalizeCatalogLocationId(ctx.locationId),
    location_name: ctx.locationName,
    list_price_inc_vat: listIncRounded,
    list_price_ex_vat: listEx,
    vat_percent: vatPercent,
    vat_label: vatLabelFromPercent(vatPercent),
    group_key: groupKey,
    group_name: groupPath.leafGroupName,
    hoofdgroep: groupPath.hoofdgroep,
    sub_category: groupPath.productgroep,
    category,
    sold_unit_price_inc_vat: null,
    sold_quantity: 0,
    sold_revenue_inc_vat: 0,
    sold_revenue_ex_vat: 0,
  }

  const existing = await db.collection<ProductCatalogDoc>(COLLECTION).findOne({ product_key: productKey })
  const { family_name, size_label } = applyCatalogFamilyFields(storedName)
  const locations = mergeLocationRow(existing?.locations ?? [], locRow)
  const locationIds = [...new Set(locations.map((l) => l.location_id))]

  const doc: ProductCatalogDoc = {
    product_key: productKey,
    display_name: storedName,
    family_name,
    size_label,
    category: pickPrimaryCategory(locations),
    hoofdgroep: pickPrimaryHoofdgroep(locations),
    sub_category: pickPrimarySubCategory(locations),
    vat_percent: vatPercent,
    vat_label: vatLabelFromPercent(vatPercent),
    location_ids: locationIds,
    locations,
    catalog_status: 'live',
    sources: {
      ...existing?.sources,
      api_catalog_at: ctx.syncedAt.toISOString(),
    },
    updated_at: ctx.syncedAt,
  }

  await adoptPlannedCatalogForBorkProduct(db, productKey, storedName)

  await db.collection<ProductCatalogDoc>(COLLECTION).updateOne(
    { product_key: productKey },
    { $set: doc },
    { upsert: true }
  )
}

/** No-op: sales-only keys lack catalog VAT and are not sellable menu products. */
export async function mergeSalesOnlyProducts(_db: Db, _syncedAt: Date): Promise<number> {
  return 0
}

/** Remove melding / no-VAT rows left from earlier syncs. */
export async function pruneNonSellableCatalogProducts(db: Db): Promise<number> {
  const result = await db.collection(COLLECTION).deleteMany({
    $or: [
      { vat_percent: null },
      { vat_label: 'unknown' },
      { sub_category: { $regex: /^melding$/i } },
      { hoofdgroep: { $regex: /^melding$/i } },
      { 'locations.sub_category': { $regex: /^melding$/i } },
      { 'locations.hoofdgroep': { $regex: /^melding$/i } },
    ],
  })
  return result.deletedCount
}

/** Re-apply brand family + size_label from display_name on all catalog docs. */
export async function recomputeAllCatalogFamilyNames(db: Db): Promise<number> {
  const coll = db.collection<ProductCatalogDoc>(COLLECTION)
  const cursor = coll.find(
    { display_name: { $exists: true, $nin: ['', '---', 'Unknown', 'unknown'] } },
    { projection: { product_key: 1, display_name: 1 } }
  )

  let updated = 0
  const batch: { updateOne: { filter: { product_key: string }; update: { $set: object } } }[] = []

  for await (const doc of cursor) {
    const name = String(doc.display_name ?? '').trim()
    if (!name) continue
    const { family_name, size_label } = applyCatalogFamilyFields(name)
    batch.push({
      updateOne: {
        filter: { product_key: doc.product_key },
        update: { $set: { family_name, size_label, updated_at: new Date() } },
      },
    })
    if (batch.length >= 500) {
      const r = await coll.bulkWrite(batch)
      updated += r.modifiedCount
      batch.length = 0
    }
  }
  if (batch.length > 0) {
    const r = await coll.bulkWrite(batch)
    updated += r.modifiedCount
  }
  return updated
}

export function normalizeProductCatalogDateRange(
  start?: string,
  end?: string
): ProductCatalogDateRange {
  const today = calendarYmdInAmsterdam(new Date())
  const rangeEnd = end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : today
  const rangeStart =
    start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : addCalendarDaysYmd(rangeEnd, -29)
  if (rangeStart > rangeEnd) {
    return { range_start: rangeEnd, range_end: rangeStart }
  }
  return { range_start: rangeStart, range_end: rangeEnd }
}

type ProductSalesTotals = {
  quantity: number
  revenue_inc: number
  revenue_ex: number
}

/** One row per productId — used for sort/filter without loading all location buckets. */
async function loadProductSalesTotals(
  db: Db,
  range: ProductCatalogDateRange
): Promise<Map<string, ProductSalesTotals>> {
  const out = new Map<string, ProductSalesTotals>()
  for (const suffix of listBorkAggReadSuffixCandidates()) {
    const collName = `bork_sales_by_product${suffix}`
    const exists = await db.listCollections({ name: collName }).hasNext()
    if (!exists) continue

    const rows = await db
      .collection(collName)
      .aggregate([
        {
          $match: {
            business_date: { $gte: range.range_start, $lte: range.range_end },
          },
        },
        {
          $group: {
            _id: '$productId',
            quantity: { $sum: { $ifNull: ['$total_quantity', 0] } },
            revenue_inc: { $sum: { $ifNull: ['$total_revenue_inc_vat', '$total_revenue', 0] } },
            revenue_ex: { $sum: { $ifNull: ['$total_revenue_ex_vat', 0] } },
          },
        },
      ])
      .toArray()

    for (const row of rows) {
      const productKey = String(row._id ?? '')
      if (!productKey) continue
      out.set(productKey, {
        quantity: Number(row.quantity ?? 0),
        revenue_inc: Number(row.revenue_inc ?? 0),
        revenue_ex: Number(row.revenue_ex ?? 0),
      })
    }
    if (out.size > 0) break
  }
  return out
}

/** Per product + venue sales (for splitting one Bork key across menu clusters). */
async function loadProductSalesByVenue(
  db: Db,
  range: ProductCatalogDateRange,
  productKeys: string[]
): Promise<Map<string, Map<string, ProductSalesTotals>>> {
  const out = new Map<string, Map<string, ProductSalesTotals>>()
  if (productKeys.length === 0) return out

  for (const suffix of listBorkAggReadSuffixCandidates()) {
    const collName = `bork_sales_by_product${suffix}`
    const exists = await db.listCollections({ name: collName }).hasNext()
    if (!exists) continue

    const rows = await db
      .collection(collName)
      .aggregate([
        {
          $match: {
            business_date: { $gte: range.range_start, $lte: range.range_end },
            productId: { $in: productKeys },
          },
        },
        {
          $group: {
            _id: { productId: '$productId', locationId: '$locationId', locationName: '$locationName' },
            quantity: { $sum: { $ifNull: ['$total_quantity', 0] } },
            revenue_inc: { $sum: { $ifNull: ['$total_revenue_inc_vat', '$total_revenue', 0] } },
            revenue_ex: { $sum: { $ifNull: ['$total_revenue_ex_vat', 0] } },
          },
        },
      ])
      .toArray()

    for (const row of rows) {
      const id = row._id as { productId?: string; locationId?: unknown; locationName?: string }
      const productKey = String(id.productId ?? '')
      if (!productKey) continue
      const venueKey = locationVenueKey(
        normalizeCatalogLocationId(id.locationId),
        String(id.locationName ?? '')
      )
      const byVenue = out.get(productKey) ?? new Map<string, ProductSalesTotals>()
      const existing = byVenue.get(venueKey) ?? { quantity: 0, revenue_inc: 0, revenue_ex: 0 }
      existing.quantity += Number(row.quantity ?? 0)
      existing.revenue_inc += Number(row.revenue_inc ?? 0)
      existing.revenue_ex += Number(row.revenue_ex ?? 0)
      byVenue.set(venueKey, existing)
      out.set(productKey, byVenue)
    }
    if (out.size > 0) break
  }
  return out
}

function soldTotalsForDocLocations(
  doc: ProductCatalogDoc,
  salesByVenue: Map<string, ProductSalesTotals> | undefined
): ProductSalesTotals {
  let quantity = 0
  let revenue_inc = 0
  let revenue_ex = 0
  for (const loc of doc.locations) {
    const venueKey = locationVenueKey(loc.location_id, loc.location_name)
    const t = salesByVenue?.get(venueKey)
    if (!t) continue
    quantity += t.quantity
    revenue_inc += t.revenue_inc
    revenue_ex += t.revenue_ex
  }
  return { quantity, revenue_inc, revenue_ex }
}

/** Same Bork product_key can map to different menu paths per venue — split for hub rows. */
function expandDocByMenuCluster(doc: ProductCatalogDoc): ProductCatalogDoc[] {
  const byCluster = new Map<string, ProductCatalogLocationRow[]>()
  for (const loc of doc.locations) {
    const ck = locationMenuClusterKey(loc)
    const list = byCluster.get(ck) ?? []
    list.push(loc)
    byCluster.set(ck, list)
  }
  if (byCluster.size <= 1) return [doc]

  return [...byCluster.entries()].map(([clusterKey, locations]) => {
    const hoofdgroep = pickPrimaryHoofdgroep(locations)
    const sub_category = pickPrimarySubCategory(locations)
    const category = classifyCategoryFromCatalogFields(hoofdgroep, sub_category)
    const vatLoc = locations.find((l) => l.vat_percent != null) ?? locations[0]
    return {
      ...doc,
      product_key: `${doc.product_key}@${clusterKey}`,
      category,
      hoofdgroep,
      sub_category,
      vat_percent: vatLoc?.vat_percent ?? doc.vat_percent,
      vat_label: vatLoc?.vat_label ?? doc.vat_label,
      location_ids: [...new Set(locations.map((l) => l.location_id))],
      locations: dedupeLocationRows(locations),
    }
  })
}

async function loadSalesByProductKeys(
  db: Db,
  range: ProductCatalogDateRange,
  productKeys: string[]
): Promise<Map<string, SalesLocBucket[]>> {
  const out = new Map<string, SalesLocBucket[]>()
  if (productKeys.length === 0) return out

  for (const suffix of listBorkAggReadSuffixCandidates()) {
    const collName = `bork_sales_by_product${suffix}`
    const exists = await db.listCollections({ name: collName }).hasNext()
    if (!exists) continue

    const rows = await db
      .collection(collName)
      .aggregate([
        {
          $match: {
            business_date: { $gte: range.range_start, $lte: range.range_end },
            productId: { $in: productKeys },
          },
        },
        {
          $group: {
            _id: {
              productId: '$productId',
              locationId: '$locationId',
              locationName: '$locationName',
              unitPrice: '$unit_price',
            },
            quantity: { $sum: { $ifNull: ['$total_quantity', 0] } },
            revenue_inc: { $sum: { $ifNull: ['$total_revenue_inc_vat', '$total_revenue', 0] } },
            revenue_ex: { $sum: { $ifNull: ['$total_revenue_ex_vat', 0] } },
          },
        },
      ])
      .toArray()

    for (const row of rows) {
      const id = row._id as {
        productId?: string
        locationId?: unknown
        locationName?: string
        unitPrice?: number
      }
      const productKey = String(id.productId ?? '')
      if (!productKey) continue
      const bucket: SalesLocBucket = {
        location_id: normalizeCatalogLocationId(id.locationId),
        location_name: String(id.locationName ?? ''),
        unit_price: Number(id.unitPrice ?? 0),
        quantity: Number(row.quantity ?? 0),
        revenue_inc: Number(row.revenue_inc ?? 0),
        revenue_ex: Number(row.revenue_ex ?? 0),
      }
      const list = out.get(productKey) ?? []
      list.push(bucket)
      out.set(productKey, list)
    }
    if (out.size > 0) break
  }
  return out
}

/** @deprecated Used by loadSoldQuantityByProductKey — prefer loadProductSalesTotals. */
async function loadSalesByProduct(
  db: Db,
  range: ProductCatalogDateRange
): Promise<Map<string, SalesLocBucket[]>> {
  const totals = await loadProductSalesTotals(db, range)
  const keys = [...totals.keys()]
  return loadSalesByProductKeys(db, range, keys)
}

function attachSalesToDoc(
  doc: ProductCatalogDoc,
  salesBuckets: SalesLocBucket[] | undefined,
  locationIdByName?: Map<string, string>
): ProductCatalogHubRow {
  const byVenue = new Map<string, ProductCatalogLocationRow>()

  const registerLocation = (row: ProductCatalogLocationRow) => {
    const id = normalizeCatalogLocationId(row.location_id)
    const normalized = { ...row, location_id: id }
    const key = locationVenueKey(id, normalized.location_name)
    const existing = byVenue.get(key)
    if (!existing) byVenue.set(key, normalized)
    else mergeLocationFieldsInto(existing, normalized)
  }

  for (const loc of doc.locations) registerLocation(loc)

  const collapsedSales = collapseSalesBucketsByLocation(salesBuckets ?? [])
  let soldQty = 0
  let soldInc = 0
  let soldEx = 0

  for (const b of collapsedSales) {
    soldQty += b.quantity
    soldInc += b.revenue_inc
    soldEx += b.revenue_ex

    let locId = normalizeCatalogLocationId(b.location_id)
    if ((!locId || !ObjectId.isValid(locId)) && b.location_name && locationIdByName) {
      const resolved = locationIdByName.get(b.location_name.trim().toLowerCase())
      if (resolved) locId = resolved
    }

    const venueKey = locationVenueKey(locId, b.location_name)
    const existing = byVenue.get(venueKey)
    if (existing) {
      existing.sold_quantity += b.quantity
      existing.sold_revenue_inc_vat += b.revenue_inc
      existing.sold_revenue_ex_vat += b.revenue_ex
      if (b.unit_price > 0) existing.sold_unit_price_inc_vat = b.unit_price
      continue
    }

    registerLocation({
      location_id: locId,
      location_name: b.location_name || locId,
      list_price_inc_vat: null,
      list_price_ex_vat: null,
      vat_percent: doc.vat_percent,
      vat_label: doc.vat_label,
      group_key: null,
      group_name: null,
      hoofdgroep: doc.hoofdgroep,
      sub_category: doc.sub_category,
      category: doc.category,
      sold_unit_price_inc_vat: b.unit_price > 0 ? b.unit_price : null,
      sold_quantity: b.quantity,
      sold_revenue_inc_vat: b.revenue_inc,
      sold_revenue_ex_vat: b.revenue_ex,
    })
  }

  const locations = [...byVenue.values()].sort((a, b) =>
    a.location_name.localeCompare(b.location_name, 'nl')
  )

  const listPrices = locations
    .map((l) => l.list_price_inc_vat)
    .filter((p): p is number => p != null && p > 0)
  const minList = listPrices.length ? Math.min(...listPrices) : null
  const maxList = listPrices.length ? Math.max(...listPrices) : null

  return {
    ...doc,
    locations,
    sold_quantity: soldQty,
    sold_revenue_inc_vat: Math.round(soldInc * 100) / 100,
    sold_revenue_ex_vat: Math.round(soldEx * 100) / 100,
    price_range_inc_vat: { min: minList, max: maxList },
  }
}

export type ProductCatalogHubSortField =
  | 'name'
  | 'category'
  | 'hoofdgroep'
  | 'productgroep'
  | 'list_ex'
  | 'list_inc'
  | 'vat'
  | 'sold_qty'
  | 'sold_revenue'
export type ProductCatalogHubSortDir = 'asc' | 'desc'

export type ProductCatalogHubSummary = {
  catalog_count: number
  listed: number
  with_sales: number
  distinct_families: number
  categories: { food: number; beverage: number; other: number }
}

export type ProductCatalogVenueOption = {
  location_id: string
  location_name: string
}

function buildCatalogHubMongoFilter(opts: {
  search?: string
  category?: ProductCatalogCategory
  locationId?: string
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    vat_percent: { $in: [21, 6] },
    locations: { $elemMatch: { list_price_inc_vat: { $gt: 0 } } },
    display_name: { $exists: true, $nin: ['', 'Unknown', 'unknown', '---'] },
    $nor: [
      { sub_category: { $regex: /^melding$/i } },
      { hoofdgroep: { $regex: /^melding$/i } },
      { display_name: { $regex: /^[\s\-–—−]+$/ } },
    ],
  }
  if (opts.search) {
    const tokens = opts.search.trim().split(/\s+/).filter(Boolean)
    const or: Record<string, unknown>[] = []
    for (const token of tokens) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      or.push(
        { display_name: { $regex: escaped, $options: 'i' } },
        { family_name: { $regex: escaped, $options: 'i' } },
        { hoofdgroep: { $regex: escaped, $options: 'i' } },
        { sub_category: { $regex: escaped, $options: 'i' } }
      )
    }
    if (/^birra$/i.test(opts.search.trim())) {
      or.push(
        { display_name: { $regex: 'moretti', $options: 'i' } },
        { family_name: { $regex: 'moretti', $options: 'i' } }
      )
    }
    filter.$or = or
  }
  if (opts.category) filter.category = opts.category
  if (opts.locationId) filter.location_ids = opts.locationId
  return filter
}

function hubRowFromDocAndTotals(
  doc: ProductCatalogDoc,
  totals: ProductSalesTotals
): ProductCatalogHubRow {
  const listPrices = doc.locations
    .map((l) => l.list_price_inc_vat)
    .filter((p): p is number => p != null && p > 0)
  return {
    ...doc,
    locations: doc.locations,
    sold_quantity: totals.quantity,
    sold_revenue_inc_vat: totals.revenue_inc,
    sold_revenue_ex_vat: totals.revenue_ex,
    price_range_inc_vat: {
      min: listPrices.length ? Math.min(...listPrices) : null,
      max: listPrices.length ? Math.max(...listPrices) : null,
    },
  }
}

function minListInc(doc: ProductCatalogDoc): number {
  const prices = doc.locations
    .map((l) => l.list_price_inc_vat)
    .filter((p): p is number => p != null && p > 0)
  return prices.length ? Math.min(...prices) : -1
}

function minListEx(doc: ProductCatalogDoc): number {
  const prices = doc.locations
    .map((l) => l.list_price_ex_vat)
    .filter((p): p is number => p != null && p > 0)
  return prices.length ? Math.min(...prices) : -1
}

function sortCatalogHubLite(
  items: ProductCatalogDoc[],
  salesTotals: Map<string, ProductSalesTotals>,
  sortBy: ProductCatalogHubSortField,
  sortDir: ProductCatalogHubSortDir
): ProductCatalogDoc[] {
  const dir = sortDir === 'desc' ? -1 : 1
  const cmpText = (a: string, b: string) => dir * a.localeCompare(b, 'nl', { sensitivity: 'base' })
  const cmpNum = (a: number, b: number) => dir * (a - b)

  return [...items].sort((a, b) => {
    const ta = salesTotals.get(a.product_key) ?? { quantity: 0, revenue_inc: 0, revenue_ex: 0 }
    const tb = salesTotals.get(b.product_key) ?? { quantity: 0, revenue_inc: 0, revenue_ex: 0 }

    switch (sortBy) {
      case 'category':
        return cmpText(a.category, b.category)
      case 'hoofdgroep':
        return cmpText(a.hoofdgroep ?? '', b.hoofdgroep ?? '')
      case 'productgroep':
        return cmpText(a.sub_category ?? '', b.sub_category ?? '')
      case 'list_inc':
        return cmpNum(minListInc(a), minListInc(b))
      case 'list_ex':
        return cmpNum(minListEx(a), minListEx(b))
      case 'vat':
        return cmpNum(a.vat_percent ?? -1, b.vat_percent ?? -1)
      case 'sold_qty':
        return cmpNum(ta.quantity, tb.quantity)
      case 'sold_revenue':
        return cmpNum(ta.revenue_inc, tb.revenue_inc)
      case 'name':
      default:
        return cmpText(a.display_name, b.display_name)
    }
  })
}

export async function loadProductCatalogVenueOptions(db: Db): Promise<ProductCatalogVenueOption[]> {
  const byId = new Map<string, string>()
  const mappings = await db.collection('bork_unified_location_mapping').find({}).toArray()
  for (const m of mappings) {
    const id = normalizeCatalogLocationId((m as { unifiedLocationId?: unknown }).unifiedLocationId)
    const name = String((m as { unifiedLocationName?: string }).unifiedLocationName ?? '').trim()
    if (id && name) byId.set(id, name)
  }
  return [...byId.entries()]
    .map(([location_id, location_name]) => ({ location_id, location_name }))
    .sort((a, b) => a.location_name.localeCompare(b.location_name, 'nl'))
}

/** Paginated hub read: sales totals for all SKUs, location detail only for the current page. */
export async function fetchProductCatalogHubPage(
  db: Db,
  opts: {
    range: ProductCatalogDateRange
    skip: number
    limit: number
    sortBy: ProductCatalogHubSortField
    sortDir: ProductCatalogHubSortDir
    search?: string
    category?: ProductCatalogCategory
    locationId?: string
    onlyWithSales?: boolean
  }
): Promise<{
  rows: ProductCatalogHubRow[]
  total: number
  catalog_count: number
  summary: ProductCatalogHubSummary
}> {
  const match = buildCatalogHubMongoFilter(opts)

  const [docs, catalog_count, locationIdByName] = await Promise.all([
    db.collection<ProductCatalogDoc>(COLLECTION).find(match).toArray(),
    db.collection(COLLECTION).countDocuments(match),
    loadUnifiedLocationIdByName(db),
  ])

  let candidates = docs
    .filter(isSellableCatalogDoc)
    .filter((doc) => hasMeaningfulCatalogName(doc.display_name))
    .map(withBrandFamily)

  const sourceKeys = [...new Set(candidates.map((d) => d.product_key))]
  const salesByVenue = await loadProductSalesByVenue(db, opts.range, sourceKeys)

  let virtualDocs: ProductCatalogDoc[] = []
  for (const doc of candidates) {
    virtualDocs.push(...expandDocByMenuCluster(doc))
  }

  const totalsByVirtualKey = new Map<string, ProductSalesTotals>()
  for (const doc of virtualDocs) {
    const sourceKey = catalogSourceProductKey(doc.product_key)
    totalsByVirtualKey.set(
      doc.product_key,
      soldTotalsForDocLocations(doc, salesByVenue.get(sourceKey))
    )
  }

  virtualDocs = virtualDocs.filter((doc) => {
    const totals = totalsByVirtualKey.get(doc.product_key) ?? { quantity: 0, revenue_inc: 0, revenue_ex: 0 }
    return !isHiddenCatalogHubRow(hubRowFromDocAndTotals(doc, totals))
  })

  if (opts.onlyWithSales) {
    virtualDocs = virtualDocs.filter(
      (doc) => (totalsByVirtualKey.get(doc.product_key)?.quantity ?? 0) > 0
    )
  }
  if (opts.locationId) {
    virtualDocs = virtualDocs.filter((doc) => doc.location_ids.includes(opts.locationId!))
  }

  const summary: ProductCatalogHubSummary = {
    catalog_count,
    listed: virtualDocs.length,
    with_sales: virtualDocs.filter(
      (d) => (totalsByVirtualKey.get(d.product_key)?.quantity ?? 0) > 0
    ).length,
    distinct_families: new Set(virtualDocs.map((d) => d.family_name)).size,
    categories: {
      food: virtualDocs.filter((d) => d.category === 'food').length,
      beverage: virtualDocs.filter((d) => d.category === 'beverage').length,
      other: virtualDocs.filter((d) => d.category === 'other').length,
    },
  }

  const sorted = sortCatalogHubLite(virtualDocs, totalsByVirtualKey, opts.sortBy, opts.sortDir)
  const total = sorted.length
  const pageDocs = sorted.slice(opts.skip, opts.skip + opts.limit)
  const pageSourceKeys = [...new Set(pageDocs.map((d) => catalogSourceProductKey(d.product_key)))]
  const salesDetail = await loadSalesByProductKeys(db, opts.range, pageSourceKeys)
  const hubDocs = pageDocs.map((doc) =>
    attachSalesToDoc(
      doc,
      salesDetail.get(catalogSourceProductKey(doc.product_key)),
      locationIdByName
    )
  )

  const menuPricesByKey = await loadMenuPricesForCatalogKeys(
    db,
    hubDocs.map((d) => d.product_key)
  )
  const rows = hubDocs.map((doc) => ({
    ...doc,
    menu_prices: menuPricesByKey.get(doc.product_key) ?? [],
  }))

  return { rows, total, catalog_count, summary }
}

/** @deprecated Prefer fetchProductCatalogHubPage — loads full catalog + all sales buckets. */
export async function fetchProductCatalogHubRows(
  db: Db,
  opts: {
    range: ProductCatalogDateRange
    search?: string
    category?: ProductCatalogCategory
    locationId?: string
    onlyWithSales?: boolean
  }
): Promise<{ rows: ProductCatalogHubRow[]; catalog_count: number }> {
  const { rows, catalog_count } = await fetchProductCatalogHubPage(db, {
    ...opts,
    skip: 0,
    limit: 100_000,
    sortBy: 'name',
    sortDir: 'asc',
  })
  return { rows, catalog_count }
}

async function loadUnifiedLocationIdByName(db: Db): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const mappings = await db.collection('bork_unified_location_mapping').find({}).toArray()
  for (const m of mappings) {
    const name = String((m as { unifiedLocationName?: string }).unifiedLocationName ?? '').trim().toLowerCase()
    const id = normalizeCatalogLocationId((m as { unifiedLocationId?: unknown }).unifiedLocationId)
    if (name && id) out.set(name, id)
  }
  const locs = await db.collection('locations').find({}, { projection: { name: 1 } }).toArray()
  for (const loc of locs) {
    const name = String((loc as { name?: string }).name ?? '').trim().toLowerCase()
    const id = normalizeCatalogLocationId((loc as { _id?: unknown })._id)
    if (name && id) out.set(name, id)
  }
  return out
}

export async function loadSoldQuantityByProductKey(
  db: Db,
  range: ProductCatalogDateRange
): Promise<Map<string, number>> {
  const totals = await loadProductSalesTotals(db, range)
  const out = new Map<string, number>()
  for (const [key, t] of totals) out.set(key, t.quantity)
  return out
}

export type BorkCredentialRow = {
  locationId: unknown
  apiKey?: string
  baseUrl?: string
  locationName?: string
}

export async function syncProductCatalogForCredential(
  db: Db,
  cred: BorkCredentialRow
): Promise<{ ok: boolean; products: number; error?: string }> {
  const lid =
    cred.locationId instanceof ObjectId ? cred.locationId.toString() : String(cred.locationId ?? '')
  const apiKey = typeof cred.apiKey === 'string' ? cred.apiKey : ''
  const baseUrl = typeof cred.baseUrl === 'string' ? cred.baseUrl : ''
  if (!apiKey || !baseUrl || !lid) {
    return { ok: false, products: 0, error: 'missing baseUrl, apiKey, or locationId' }
  }

  const locationName = await resolveLocationName(
    db,
    lid,
    typeof cred.locationName === 'string' ? cred.locationName : undefined
  )
  const syncedAt = new Date()

  const groupRes = await fetchBorkCatalogJson(baseUrl, apiKey, '/catalog/productgrouplist.json')
  if (groupRes.ok) {
    await upsertBorkMasterRaw(
      db,
      cred.locationId,
      lid,
      'bork_master_productgrouplist',
      'bork_master:productgrouplist',
      groupRes.data
    )
  }

  const listRes = await fetchBorkCatalogJson(baseUrl, apiKey, '/catalog/productlist.json')
  if (!listRes.ok) {
    return { ok: false, products: 0, error: listRes.error ?? `HTTP ${listRes.status}` }
  }

  await upsertBorkMasterRaw(
    db,
    cred.locationId,
    lid,
    'bork_master_productlist',
    'bork_master:productlist',
    listRes.data
  )

  const groups = extractRecords(groupRes.ok ? groupRes.data : [])
  const products = extractRecords(listRes.data) as BorkProductRow[]
  const groupIndex = buildGroupIndex(groups)

  for (const product of products) {
    await upsertCatalogProductFromApi(db, product, {
      locationId: lid,
      locationName,
      groupIndex,
      syncedAt,
    })
  }

  return { ok: true, products: products.length }
}
