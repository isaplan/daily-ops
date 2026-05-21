/**
 * @registry-id: productCatalog
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Unified product_catalog hub — Bork API catalog + sales rollups
 * @last-fix: [2026-05-20] Map category from Bork Hoofdgroep (L2) + sub from Productgroep (L3/L4)
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

const COLLECTION = 'product_catalog'

const SIZE_PATTERN =
  /\s+((?:fluit|vaas|pint|glas|mug|fles|pitcher|kan)\b|\d+(?:[.,]\d+)?\s*(?:cl|ml|l))\s*$/i

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

export function classifyCategoryFromHoofdgroep(hoofdgroep: string | null): ProductCatalogCategory {
  const h = (hoofdgroep ?? '').trim().toLowerCase()
  if (/^dranken\s+(hoog|laag)$/.test(h)) return 'beverage'
  if (h === 'keuken') return 'food'
  if (h === 'non-food') return 'other'
  return 'other'
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

export function parseProductVariantLabel(displayName: string): {
  family_name: string
  size_label: string | null
} {
  const trimmed = displayName.trim()
  const m = trimmed.match(SIZE_PATTERN)
  if (m && m.index != null && m.index > 0) {
    return {
      family_name: trimmed.slice(0, m.index).trim() || trimmed,
      size_label: (m[1] ?? '').replace(/\s+/g, ' ').trim() || null,
    }
  }
  return { family_name: trimmed, size_label: null }
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

function mergeLocationRow(
  existing: ProductCatalogLocationRow[],
  row: ProductCatalogLocationRow
): ProductCatalogLocationRow[] {
  const out = existing.filter((l) => l.location_id !== row.location_id)
  out.push(row)
  out.sort((a, b) => a.location_name.localeCompare(b.location_name, 'nl'))
  return out
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

  const displayName = String(product.Name ?? '').trim() || 'Unknown'
  const groupKey = groupKeyString(product.GroupKey)
  const groupPath = ctx.groupIndex.resolvePath(groupKey)
  const category = classifyCategoryFromHoofdgroep(groupPath.hoofdgroep)
  const vatPercent = resolveCatalogVatPercent(Number(product.Vat ?? 0))
  if (!isSellableCatalogProduct({ vatPercent, groupPath })) {
    return
  }

  const listInc = Number(product.Price ?? 0)
  const listIncRounded = Number.isFinite(listInc) && listInc > 0 ? Math.round(listInc * 100) / 100 : null
  const listEx = listIncRounded != null ? priceExFromInc(listIncRounded, vatPercent) : null

  const locRow: ProductCatalogLocationRow = {
    location_id: ctx.locationId,
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
  const { family_name, size_label } = parseProductVariantLabel(displayName)
  const locations = mergeLocationRow(existing?.locations ?? [], locRow)
  const locationIds = [...new Set(locations.map((l) => l.location_id))]

  const doc: ProductCatalogDoc = {
    product_key: productKey,
    display_name: displayName,
    family_name,
    size_label,
    category: pickPrimaryCategory(locations),
    hoofdgroep: pickPrimaryHoofdgroep(locations),
    sub_category: pickPrimarySubCategory(locations),
    vat_percent: vatPercent,
    vat_label: vatLabelFromPercent(vatPercent),
    location_ids: locationIds,
    locations,
    sources: {
      ...existing?.sources,
      api_catalog_at: ctx.syncedAt.toISOString(),
    },
    updated_at: ctx.syncedAt,
  }

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

async function loadSalesByProduct(
  db: Db,
  range: ProductCatalogDateRange
): Promise<Map<string, SalesLocBucket[]>> {
  const out = new Map<string, SalesLocBucket[]>()
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
        location_id: String(id.locationId ?? ''),
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

function attachSalesToDoc(
  doc: ProductCatalogDoc,
  salesBuckets: SalesLocBucket[] | undefined
): ProductCatalogHubRow {
  const byLoc = new Map<string, ProductCatalogLocationRow>()

  for (const loc of doc.locations) {
    byLoc.set(loc.location_id, { ...loc })
  }

  let soldQty = 0
  let soldInc = 0
  let soldEx = 0
  const soldPrices: number[] = []

  for (const b of salesBuckets ?? []) {
    soldQty += b.quantity
    soldInc += b.revenue_inc
    soldEx += b.revenue_ex
    if (b.unit_price > 0) soldPrices.push(b.unit_price)

    const existing = byLoc.get(b.location_id)
    if (existing) {
      existing.sold_quantity += b.quantity
      existing.sold_revenue_inc_vat += b.revenue_inc
      existing.sold_revenue_ex_vat += b.revenue_ex
      if (b.unit_price > 0) existing.sold_unit_price_inc_vat = b.unit_price
    } else {
      byLoc.set(b.location_id, {
        location_id: b.location_id,
        location_name: b.location_name || b.location_id,
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
  }

  const locations = [...byLoc.values()].sort((a, b) =>
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
  const filter: Record<string, unknown> = {}
  if (opts.search) {
    const escaped = opts.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { display_name: { $regex: escaped, $options: 'i' } },
      { family_name: { $regex: escaped, $options: 'i' } },
    ]
  }
  if (opts.category) filter.category = opts.category
  if (opts.locationId) filter.location_ids = opts.locationId

  const docs = (
    await db
      .collection<ProductCatalogDoc>(COLLECTION)
      .find(filter)
      .sort({ family_name: 1, display_name: 1 })
      .toArray()
  ).filter(isSellableCatalogDoc)

  const salesMap = await loadSalesByProduct(db, opts.range)
  let rows = docs.map((doc) => attachSalesToDoc(doc, salesMap.get(doc.product_key)))

  if (opts.onlyWithSales) {
    rows = rows.filter((r) => r.sold_quantity > 0)
  }
  if (opts.locationId) {
    rows = rows.filter((r) =>
      r.locations.some((l) => l.location_id === opts.locationId && l.sold_quantity + (l.list_price_inc_vat ?? 0) > 0)
    )
  }

  rows.sort((a, b) => {
    const fam = a.family_name.localeCompare(b.family_name, 'nl')
    if (fam !== 0) return fam
    return a.display_name.localeCompare(b.display_name, 'nl')
  })

  return { rows, catalog_count: docs.length }
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
