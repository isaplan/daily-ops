/**
 * @registry-id: dailyOpsSnapshotRebuildSpacesPostApi
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-06-02T00:00:00.000Z
 * @description: POST /api/daily-ops/snapshot/rebuild-spaces — rebuild snapshots for last N days after space config change
 * @last-fix: [2026-06-02] Rebuild all venue-strip locations; unified id resolution
 * @adr-ref: ADR-004, ADR-006
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsRevenueSpaceConfigModal.vue
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../../../utils/db'
import { resolveUnifiedLocationId } from '../../../utils/locationUnifiedIdResolver'
import { rebuildSnapshotsForBusinessDateRange } from '../../../utils/dailyOpsSnapshot/triggerSnapshotRebuilds'
import { VENUE_STRIP_LOCATIONS } from '../../../utils/venueStrip/constants'
import { amsterdamTodayYmd, amsterdamYmdForOffset } from '../../../../utils/inbox/importTableQuickDates'

const MAX_REBUILD_DAYS = 60

type Body = {
  locationId?: string
  days?: number
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Body
  const locationId = body.locationId?.trim()
  if (!locationId) throw createError({ statusCode: 400, statusMessage: 'locationId required' })
  if (!ObjectId.isValid(locationId)) throw createError({ statusCode: 400, statusMessage: 'Invalid locationId' })

  const days = Math.min(Math.max(Math.trunc(Number(body.days ?? MAX_REBUILD_DAYS)), 1), MAX_REBUILD_DAYS)
  const endDate = amsterdamTodayYmd()
  const startDate = amsterdamYmdForOffset(-(days - 1))

  const db = await getDb()
  const unifiedLocationId = await resolveUnifiedLocationId(db, locationId)

  const unifiedIds = new Set<string>(VENUE_STRIP_LOCATIONS.map((v) => v.locationId))
  unifiedIds.add(unifiedLocationId)

  let built = 0
  let errors = 0
  for (const uid of unifiedIds) {
    const result = await rebuildSnapshotsForBusinessDateRange(db, startDate, endDate, uid)
    built += result.built
    errors += result.errors
  }

  return {
    success: errors === 0,
    locationId,
    unifiedLocationId,
    rebuiltLocationIds: [...unifiedIds],
    startDate,
    endDate,
    days,
    built,
    errors,
  }
})
