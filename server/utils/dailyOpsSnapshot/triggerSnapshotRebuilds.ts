/**
 * @registry-id: dailyOpsSnapshotTriggerRebuilds
 * @created: 2026-05-27T00:00:00.000Z
 * @last-modified: 2026-06-02T00:00:00.000Z
 * @description: Enqueue or run daily_ops_snapshot rebuilds after Bork/Eitje aggregation writes.
 * @last-fix: [2026-06-02] Bork location discovery uses suffix fallback (_test vs _v2)
 * @adr-ref: ADR-004
 *
 * @architecture:
 *   - Warm tier (bork_*, eitje_time_registration_aggregation) updates must refresh hot snapshots.
 *   - Coalesced enqueue for burst rebuilds; synchronous range build after daily cron (Bork then Eitje).
 *
 * @exports-to:
 * ✓ server/services/borkRebuildAggregationV2Service.ts
 * ✓ server/tasks/integrations/bork-eitje-daily.ts
 * ✓ server/services/eitjeSyncService.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { distinctBorkLocationIdsForDate } from '../bork/distinctBorkLocationIdsForDate'
import { buildDailyOpsSnapshotRange } from '../../services/dailyOpsSnapshotService'
import { eachBusinessDate } from '../dailyOpsRevenue/dateRange'
import { enqueueSnapshotBuild } from './jobCoalescer'

function normalizeLocationId(raw: unknown): string {
  if (raw == null) return ''
  if (raw instanceof ObjectId) return raw.toString()
  return String(raw).trim()
}

/** Locations with warm-tier rows for this business_date (Bork revenue and/or Eitje labor). */
export async function listAffectedLocationIdsForBusinessDate(
  db: Db,
  businessDate: string,
): Promise<string[]> {
  const [borkLocs, eitjeLocs, inboxLocs] = await Promise.all([
    distinctBorkLocationIdsForDate(db, businessDate),
    db.collection('eitje_time_registration_aggregation').distinct('locationId', { period: businessDate }),
    db.collection('inbox-bork-basis-report').distinct('location_id', { business_date: businessDate }),
  ])

  const set = new Set<string>()
  for (const raw of [...borkLocs, ...eitjeLocs, ...inboxLocs]) {
    const id = normalizeLocationId(raw)
    if (id) set.add(id)
  }
  return Array.from(set)
}

/** Debounced per (businessDate, locationId) — use after aggregation writes. */
export async function enqueueSnapshotsForBusinessDateRange(
  db: Db,
  startDate: string,
  endDate: string,
): Promise<number> {
  let enqueued = 0
  for (const businessDate of eachBusinessDate(startDate, endDate)) {
    const locationIds = await listAffectedLocationIdsForBusinessDate(db, businessDate)
    for (const locationId of locationIds) {
      enqueueSnapshotBuild({ businessDate, locationId })
      enqueued += 1
    }
  }
  if (enqueued > 0) {
    console.info(
      `[snapshot:trigger] enqueued ${enqueued} rebuild(s) for business_date ${startDate}..${endDate}`,
    )
  }
  return enqueued
}

/** Synchronous materialization — use after daily Bork+Eitje cron completes. */
export async function rebuildSnapshotsForBusinessDateRange(
  _db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<{ built: number; errors: number }> {
  const { built, errors } = await buildDailyOpsSnapshotRange({ startDate, endDate, locationId })
  console.info(
    `[snapshot:trigger] materialized ${built} snapshot(s), errors=${errors}, business_date ${startDate}..${endDate}`,
  )
  return { built, errors }
}
