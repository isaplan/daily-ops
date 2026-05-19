/**
 * @registry-id: productCatalogService
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Sync unified product_catalog from Bork API credentials
 * @last-fix: [2026-05-20] Initial catalog sync orchestration
 *
 * @exports-to:
 * ✓ server/api/daily-ops/product-catalog/sync.post.ts
 * ✓ server/services/borkSyncService.ts
 */

import type { Db } from 'mongodb'
import {
  mergeSalesOnlyProducts,
  syncProductCatalogForCredential,
  type BorkCredentialRow,
} from '../utils/productCatalog'

export type ProductCatalogSyncResult = {
  ok: boolean
  message: string
  locations_ok: number
  locations_total: number
  products_written: number
  sales_only_added: number
}

async function loadBorkCredentials(db: Db): Promise<BorkCredentialRow[]> {
  return db
    .collection('api_credentials')
    .find({
      provider: { $in: ['bork', 'Bork'] },
      $nor: [{ isActive: false }],
    })
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray() as Promise<BorkCredentialRow[]>
}

export async function syncProductCatalogFromBorkApi(db: Db): Promise<ProductCatalogSyncResult> {
  const creds = await loadBorkCredentials(db)
  if (creds.length === 0) {
    return {
      ok: false,
      message: 'No Bork credentials found',
      locations_ok: 0,
      locations_total: 0,
      products_written: 0,
      sales_only_added: 0,
    }
  }

  const syncedAt = new Date()
  let locationsOk = 0
  let productsWritten = 0
  const errors: string[] = []

  for (const cred of creds) {
    const r = await syncProductCatalogForCredential(db, cred)
    if (r.ok) {
      locationsOk++
      productsWritten += r.products
    } else if (r.error) {
      errors.push(r.error)
    }
  }

  const salesOnlyAdded = await mergeSalesOnlyProducts(db, syncedAt)

  const ok = locationsOk > 0
  const message = ok
    ? `Synced catalog for ${locationsOk}/${creds.length} location(s); ${productsWritten} API product rows; ${salesOnlyAdded} sales-only keys added.`
    : `Catalog sync failed: ${errors[0] ?? 'no locations succeeded'}`

  return {
    ok,
    message,
    locations_ok: locationsOk,
    locations_total: creds.length,
    products_written: productsWritten,
    sales_only_added: salesOnlyAdded,
  }
}
