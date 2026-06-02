/**
 * @registry-id: borkDistinctLocationIdsForDate
 * @created: 2026-06-02T00:00:00.000Z
 * @last-modified: 2026-06-02T00:00:00.000Z
 * @description: Distinct unified locationIds with Bork warm-tier rows for a business_date (suffix fallback)
 * @last-fix: [2026-06-02] Union across bork_business_days suffix candidates (_test vs _v2)
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/triggerSnapshotRebuilds.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { listBorkAggReadSuffixCandidates } from '../borkAggVersionSuffix'

function normalizeLocationId(raw: unknown): string {
  if (raw == null) return ''
  if (raw instanceof ObjectId) return raw.toString()
  return String(raw).trim()
}

/** All unified locationIds with bork_business_days rows on this register day (any suffix candidate). */
export async function distinctBorkLocationIdsForDate(db: Db, businessDate: string): Promise<string[]> {
  const seen = new Set<string>()
  for (const suffix of listBorkAggReadSuffixCandidates()) {
    const coll = `bork_business_days${suffix}`
    if (!(await db.listCollections({ name: coll }).hasNext())) continue
    const ids = await db.collection(coll).distinct('locationId', { business_date: businessDate })
    for (const raw of ids) {
      const id = normalizeLocationId(raw)
      if (id) seen.add(id)
    }
  }
  return Array.from(seen)
}
