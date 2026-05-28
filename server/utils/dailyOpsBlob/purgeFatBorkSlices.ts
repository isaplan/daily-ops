/**
 * @registry-id: dailyOpsPurgeFatBorkSlices
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Delete fat bork_sales_by_* rows after snapshot seal (warm buffer only)
 * @adr-ref: ADR-006
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { resolveBorkAggReadSuffix } from '../borkAggVersionSuffix'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'

const FAT_BORK_BASES = [
  'bork_sales_by_hour',
  'bork_sales_by_order_hour',
  'bork_sales_by_day',
  'bork_sales_by_table',
  'bork_sales_by_worker',
  'bork_sales_by_order_worker',
  'bork_sales_by_guest_account',
  'bork_sales_by_product',
] as const

export type PurgeFatBorkResult = {
  businessDate: string
  locationId: string
  deletedByCollection: Record<string, number>
}

function locationMatch(locationId: string): ObjectId | string {
  return ObjectId.isValid(locationId) ? new ObjectId(locationId) : locationId
}

/** Delete fat aggregate slices for one sealed venue-day. Keeps bork_business_days (warm). */
export async function purgeFatBorkSlicesForVenueDay(
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<PurgeFatBorkResult> {
  const master = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master).findOne({
    businessDate,
    locationId,
    status: 'final',
  })
  if (!master) {
    throw new Error(`Snapshot not final for ${businessDate} ${locationId}`)
  }

  const suffix = resolveBorkAggReadSuffix()
  const filter = { business_date: businessDate, locationId: locationMatch(locationId) }
  const deletedByCollection: Record<string, number> = {}

  for (const base of FAT_BORK_BASES) {
    const name = `${base}${suffix}`
    const r = await db.collection(name).deleteMany(filter)
    deletedByCollection[name] = r.deletedCount ?? 0
  }

  return { businessDate, locationId, deletedByCollection }
}
