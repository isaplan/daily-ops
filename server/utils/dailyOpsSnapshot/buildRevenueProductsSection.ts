/**
 * @registry-id: dailyOpsSnapshotBuildRevenueProductsSection
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Product + category snapshot section — inbox (Datalab) for closed days, Bork API for today.
 * @last-fix: [2026-05-28] For closed business days use inbox.sections.netto_sales.categories (SSOT); Bork fallback for today.
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { resolveBorkAggReadSuffix } from '../borkAggVersionSuffix'
import { loadProductCatalogCategoryMap } from '../borkFoodBeverageSplit'
import { classifyCategoryFromCatalogFields } from '../productCatalog'
import type { DailyOpsSnapshotRevenueProductsSection } from '../../../types/daily-ops-snapshot'
import type { BuildRevenueInput } from './buildRevenueSection'
import type { ProductCatalogCategory } from '~/types/product-catalog'
import type { BasisReportData } from '../inbox/basis-report-mapper'

function docRevenueEx(doc: Record<string, unknown>): number {
  const ex = Number(doc.total_revenue_ex_vat ?? 0)
  if (ex > 0) return ex
  return Number(doc.total_revenue ?? 0)
}

export async function buildRevenueProductsSection(
  db: Db,
  input: BuildRevenueInput,
): Promise<DailyOpsSnapshotRevenueProductsSection> {
  const { businessDate, locationId, locationName } = input
  const suffix = resolveBorkAggReadSuffix()
  const locOid = ObjectId.isValid(locationId) ? new ObjectId(locationId) : null

  // Try inbox categories first (SSOT for closed days)
  const inboxRow = await db.collection('inbox-bork-basis-report').findOne({
    location_id: locationId,
    cron_hour: { $in: [7, 8] },
    business_date: businessDate,
  })

  const inboxCategories = (inboxRow as BasisReportData | null)?.sections?.netto_sales?.categories

  // If inbox has categories, use them directly
  if (inboxCategories && inboxCategories.length > 0) {
    const categories = inboxCategories
      .map((cat: { name?: string; quantity?: number; price_ex_vat?: number; price_incl_vat?: number }) => ({
        name: cat.name || 'Onbekend',
        revenue_ex_vat: Number(cat.price_ex_vat ?? 0),
        quantity: Number(cat.quantity ?? 0),
      }))
      .filter((c) => c.name.toLowerCase() !== 'meldingen') // Skip meldingen
      .sort((a, b) => b.revenue_ex_vat - a.revenue_ex_vat)

    return {
      schema_version: 1,
      businessDate,
      locationId,
      locationName,
      categories,
      products: [], // No product detail from inbox
      lastBuiltAt: new Date(),
    }
  }

  // Fallback to Bork API for today or if no inbox
  const coll = `bork_sales_by_product${suffix}`
  const [rows, catalogMap, catalogHoofdgroep] = locOid
    ? await Promise.all([
        db.collection(coll).find({ business_date: businessDate, locationId: locOid }).toArray(),
        loadProductCatalogCategoryMap(db, {
          salesRange: { range_start: businessDate, range_end: businessDate },
        }),
        db
          .collection('product_catalog')
          .find({}, { projection: { product_key: 1, hoofdgroep: 1, sub_category: 1 } })
          .toArray(),
      ])
    : [[], new Map<string, ProductCatalogCategory>(), []]

  const catalogFieldsByKey = new Map<string, { hoofdgroep: string | null; sub_category: string | null }>()
  for (const doc of catalogHoofdgroep) {
    const key = String((doc as { product_key?: string }).product_key ?? '')
    if (key) {
      catalogFieldsByKey.set(key, {
        hoofdgroep: (doc as { hoofdgroep?: string | null }).hoofdgroep ?? null,
        sub_category: (doc as { sub_category?: string | null }).sub_category ?? null,
      })
    }
  }

  function snapshotCategoryLabel(productId: string, productName: string): string {
    const cat = catalogMap.get(productId)
    const fields = catalogFieldsByKey.get(productId)
    if (cat === 'beverage') {
      return fields?.sub_category?.trim() || fields?.hoofdgroep?.trim() || 'Dranken'
    }
    if (cat === 'food') return 'Keuken'
    if (cat === 'other') return 'Non-Food'
    if (fields) {
      const derived = classifyCategoryFromCatalogFields(fields.hoofdgroep, fields.sub_category)
      if (derived === 'beverage') {
        return fields.sub_category?.trim() || fields.hoofdgroep?.trim() || 'Dranken'
      }
      if (derived === 'food') return 'Keuken'
    }
    return productName
  }

  const catMap = new Map<string, { revenue_ex_vat: number; quantity: number }>()
  const products: DailyOpsSnapshotRevenueProductsSection['products'] = []

  for (const r of rows) {
    const doc = r as Record<string, unknown>
    const rev = docRevenueEx(doc)
    const qty = Number(doc.total_quantity ?? 0)
    const productId = String(doc.productId ?? doc.product_id ?? '')
    const productName = String(doc.productName ?? doc.product_name ?? 'Onbekend')
    const category = snapshotCategoryLabel(productId, productName)

    products.push({ productId, productName, revenue_ex_vat: rev, quantity: qty })
    const c = catMap.get(category) ?? { revenue_ex_vat: 0, quantity: 0 }
    c.revenue_ex_vat += rev
    c.quantity += qty
    catMap.set(category, c)
  }

  products.sort((a, b) => b.revenue_ex_vat - a.revenue_ex_vat)

  const categories = Array.from(catMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue_ex_vat - a.revenue_ex_vat)

  return {
    schema_version: 1,
    businessDate,
    locationId,
    locationName,
    categories,
    products: products.slice(0, 500),
    lastBuiltAt: new Date(),
  }
}
