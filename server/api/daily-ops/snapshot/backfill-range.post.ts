/**
 * @registry-id: dailyOpsSnapshotBackfillRangePostApi
 * @created: 2026-06-05T14:00:00.000Z
 * @last-modified: 2026-06-05T14:00:00.000Z
 * @description: POST /api/daily-ops/snapshot/backfill-range — rebuild snapshots for all venues over a date range.
 *   Sealed days skip fat Bork sections if already populated (guard in dailyOpsSnapshotService).
 *   Use for year-to-date backfills when Bork slices are still available or to refresh revenue/labor from snapshot.
 * @last-fix: [2026-06-05] Initial implementation
 * @adr-ref: ADR-004, ADR-006, ADR-007
 *
 * @exports-to: (admin use / curl)
 */

import { VENUE_STRIP_LOCATIONS } from '../../../utils/venueStrip/constants'
import { rebuildSnapshotsForBusinessDateRange } from '../../../utils/dailyOpsSnapshot/triggerSnapshotRebuilds'
import { getDb } from '../../../utils/db'

type Body = {
  startDate: string
  endDate: string
  locationIds?: string[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Body

  if (!body.startDate || !DATE_RE.test(body.startDate))
    throw createError({ statusCode: 400, statusMessage: 'startDate required (YYYY-MM-DD)' })
  if (!body.endDate || !DATE_RE.test(body.endDate))
    throw createError({ statusCode: 400, statusMessage: 'endDate required (YYYY-MM-DD)' })
  if (body.startDate > body.endDate)
    throw createError({ statusCode: 400, statusMessage: 'startDate must be ≤ endDate' })

  const locationIds: string[] =
    body.locationIds && body.locationIds.length > 0
      ? body.locationIds
      : VENUE_STRIP_LOCATIONS.map((v) => v.locationId)

  const db = await getDb()

  // Run async so the HTTP response returns immediately — backfills can take
  // several minutes for a full year across 3 venues.
  Promise.resolve().then(async () => {
    let totalBuilt = 0
    let totalErrors = 0
    for (const locationId of locationIds) {
      const result = await rebuildSnapshotsForBusinessDateRange(
        db,
        body.startDate,
        body.endDate,
        locationId,
      )
      totalBuilt += result.built
      totalErrors += result.errors
      console.info(
        `[backfill-range] ${locationId} done — built=${result.built} errors=${result.errors}`,
      )
    }
    console.info(
      `[backfill-range] COMPLETE ${body.startDate}..${body.endDate} totalBuilt=${totalBuilt} totalErrors=${totalErrors}`,
    )
  }).catch((err: unknown) => {
    console.error('[backfill-range] FAILED', err)
  })

  return {
    status: 'started',
    startDate: body.startDate,
    endDate: body.endDate,
    locationIds,
    message: 'Backfill running in background — check server logs for [backfill-range] progress.',
  }
})
