/**
 * @registry-id: dailyOpsSnapshotApi
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-13T00:00:00.000Z
 * @description: Read endpoint for the Daily Ops Snapshot system (Phase A.3).
 *   Returns master + revenue section + labor section for one (businessDate, locationId).
 *   Pure read — never touches Bork/Eitje/inbox raw collections.
 * @last-fix: [2026-05-13] Initial.
 *
 * @architecture:
 *   - Query params: businessDate=YYYY-MM-DD, locationId=<unifiedLocationId> (both required).
 *   - One read per collection (3 total), no $lookup, all names already denormalized.
 *
 * @exports-to:
 *   ✓ components/daily-ops/DailyOpsHomeDashboard.vue (future direct-read path)
 *   ✓ debugging / manual inspection
 */

import { getDb } from '../../utils/db'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import type {
  DailyOpsSnapshotLaborSection,
  DailyOpsSnapshotMaster,
  DailyOpsSnapshotRevenueSection,
} from '~/types/daily-ops-snapshot'

type DailyOpsSnapshotBundle = {
  master: DailyOpsSnapshotMaster | null
  revenue: DailyOpsSnapshotRevenueSection | null
  labor: DailyOpsSnapshotLaborSection | null
}

export default defineEventHandler(async (event): Promise<DailyOpsSnapshotBundle> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event) as Record<string, unknown>
  const businessDate = typeof q.businessDate === 'string' ? q.businessDate : ''
  const locationId = typeof q.locationId === 'string' ? q.locationId : ''

  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate) || !locationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'businessDate (YYYY-MM-DD) and locationId are required',
    })
  }

  const db = await getDb()
  const filter = { businessDate, locationId }
  const [master, revenue, labor] = await Promise.all([
    db.collection<DailyOpsSnapshotMaster>(DAILY_OPS_SNAPSHOT_COLLECTIONS.master).findOne(filter),
    db
      .collection<DailyOpsSnapshotRevenueSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection)
      .findOne(filter),
    db
      .collection<DailyOpsSnapshotLaborSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection)
      .findOne(filter),
  ])

  return { master, revenue, labor }
})
