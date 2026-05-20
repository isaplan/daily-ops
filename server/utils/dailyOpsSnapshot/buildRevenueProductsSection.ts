/**
 * @registry-id: dailyOpsSnapshotBuildRevenueProductsSection
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Product + category snapshot section from bork_sales_by_product
 * @last-fix: [2026-05-20] Initial
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { resolveBorkAggReadSuffix } from '../borkAggVersionSuffix'
import type { DailyOpsSnapshotRevenueProductsSection } from '../../../types/daily-ops-snapshot'
import type { BuildRevenueInput } from './buildRevenueSection'

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
  const coll = `bork_sales_by_product${suffix}`

  const rows = locOid
    ? await db
        .collection(coll)
        .find({ business_date: businessDate, locationId: locOid })
        .toArray()
    : []

  const catMap = new Map<string, { revenue_ex_vat: number; quantity: number }>()
  const products: DailyOpsSnapshotRevenueProductsSection['products'] = []

  for (const r of rows) {
    const doc = r as Record<string, unknown>
    const rev = docRevenueEx(doc)
    const qty = Number(doc.total_quantity ?? 0)
    const productId = String(doc.productId ?? doc.product_id ?? '')
    const productName = String(doc.productName ?? doc.product_name ?? 'Onbekend')
    const category = String(doc.categoryName ?? doc.category ?? 'Overig')

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
