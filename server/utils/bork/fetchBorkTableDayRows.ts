/**
 * @registry-id: borkFetchTableDayRows
 * @created: 2026-06-02T00:00:00.000Z
 * @last-modified: 2026-06-02T00:00:00.000Z
 * @description: Load per-table Bork warm-tier rows for one business day + location (suffix fallback)
 * @last-fix: [2026-06-02] Try listBorkAggReadSuffixCandidates when primary suffix collection is empty
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/buildRevenueTablesSection.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { listBorkAggReadSuffixCandidates } from '../borkAggVersionSuffix'

export async function fetchBorkTableDayRows(
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<Record<string, unknown>[]> {
  if (!ObjectId.isValid(locationId)) return []
  const locOid = new ObjectId(locationId)
  const filter = { business_date: businessDate, locationId: locOid }

  for (const suffix of listBorkAggReadSuffixCandidates()) {
    const coll = `bork_sales_by_table${suffix}`
    const exists = await db.listCollections({ name: coll }).hasNext()
    if (!exists) continue
    const rows = (await db.collection(coll).find(filter).toArray()) as Record<string, unknown>[]
    if (rows.length > 0) return rows
  }
  return []
}
