/**
 * @registry-id: dailyOpsSnapshotTriggerRebuilds
 * @created: 2026-05-27T00:00:00.000Z
 * @last-modified: 2026-07-13T01:12:00.000Z
 * @description: Enqueue or run daily_ops_snapshot rebuilds after Bork/Eitje aggregation writes.
 *   Per-venue source freshness tracking: if any source (Bork, Eitje, Inbox) has lastSyncAt > snapshot.lastBuiltAt,
 *   trigger rebuild for that venue. Never skip venue from rebuild — always include all VENUE_STRIP_LOCATIONS.
 * @last-fix: [2026-07-13] Add isSnapshotStaleVsAnySources() for per-venue, per-source freshness check (Phase 5).
 *   Prior: [2026-07-11] Gap scan endDate = open register day (ADR-010), not calendar yesterday
 *   Prior: [2026-07-09] findSnapshotGapVenueDays + explicit startDate/endDate range scan
 *   Prior: [2026-07-09] Historical gap backfill — warm tier without master snapshot (60d lookback)
 *   Prior: [2026-07-01] Pipeline tail includes daily + weekly/monthly/yearly JSON cascade
 *   Prior: [2026-06-24] materializeIntegrationPipelineSnapshots — sync tail for integration crons
 * @adr-ref: ADR-004, ADR-006
 *
 * @architecture:
 *   - VENUE_STRIP_LOCATIONS = SSOT for 3 venues (always attempt snapshot for all, never selective skip).
 *   - Warm tier (bork_*, eitje_time_registration_aggregation, inbox-bork-basis-report) updates must refresh hot snapshots.
 *   - Source freshness per venue: if Bork/Eitje/Inbox lastSyncAt > snapshot.lastBuiltAt → rebuild that venue.
 *   - Coalesced enqueue for burst rebuilds; synchronous range build after daily cron (Bork then Eitje).
 *
 * @exports-to:
 * ✓ server/services/borkRebuildAggregationV2Service.ts
 * ✓ server/tasks/integrations/bork-eitje-daily.ts
 * ✓ server/services/eitjeSyncService.ts
 * ✓ scripts/backfill-snapshot-gaps.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { distinctBorkLocationIdsForDate } from '../bork/distinctBorkLocationIdsForDate'
import { resolveBorkAggReadSuffix } from '../borkAggVersionSuffix'
import { REV_EPS } from '../opsNotifications/scanContext'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import { buildDailyOpsSnapshotRange } from '../../services/dailyOpsSnapshotService'
import { eachBusinessDate } from '../dailyOpsRevenue/dateRange'
import { enqueueSnapshotBuild } from './jobCoalescer'
import { resolveSources } from './resolveSources'

/** Historical cron scans beyond 7d/31d sync window for orphaned warm-tier days. */
export const SNAPSHOT_GAP_LOOKBACK_DAYS = 60

function normalizeLocationId(raw: unknown): string {
  if (raw == null) return ''
  if (raw instanceof ObjectId) return raw.toString()
  return String(raw).trim()
}

/**
 * Check if any source (Bork, Eitje, Inbox) has newer data than the snapshot.
 * Per-venue, per-source freshness — if any source is newer, rebuild needed.
 */
async function isSnapshotStaleVsAnySources(
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<boolean> {
  const [snapshot, sources] = await Promise.all([
    db
      .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master)
      .findOne({ businessDate, locationId }, { projection: { lastBuiltAt: 1 } }),
    resolveSources(db, businessDate, locationId),
  ])

  if (!snapshot?.lastBuiltAt) return true // No snapshot yet → stale

  const builtMs = new Date(snapshot.lastBuiltAt).getTime()

  // Check if any source is newer than snapshot
  const checkSource = (lastSyncAt: Date | null | undefined): boolean => {
    if (!lastSyncAt) return false
    const syncMs = new Date(lastSyncAt).getTime()
    return syncMs > builtMs
  }

  if (checkSource(sources.bork.lastSyncAt)) return true
  if (checkSource(sources.eitje.lastSyncAt)) return true
  if (checkSource(sources.inbox.lastSyncAt)) return true

  return false // All sources older than snapshot
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
    // Always enqueue all 3 venues; no selective skip based on which sources have data
    for (const venue of VENUE_STRIP_LOCATIONS) {
      enqueueSnapshotBuild({ businessDate, locationId: venue.locationId })
      enqueued += 1
    }
  }
  if (enqueued > 0) {
    console.info(
      `[snapshot:trigger] enqueued ${enqueued} rebuild(s) for business_date ${startDate}..${endDate} (all venues)`,
    )
  }
  return enqueued
}

/**
 * Enqueue rebuilds for venues where any source (Bork, Eitje, Inbox) has newer data than snapshot.
 * Per-source, per-venue freshness check — non-blocking rebuild trigger.
 */
export async function enqueueSourceTriggeredSnapshotRebuild(
  db: Db,
  businessDate: string,
): Promise<number> {
  let enqueued = 0
  for (const venue of VENUE_STRIP_LOCATIONS) {
    const isStale = await isSnapshotStaleVsAnySources(db, businessDate, venue.locationId)
    if (isStale) {
      enqueueSnapshotBuild({ businessDate, locationId: venue.locationId })
      enqueued += 1
    }
  }
  if (enqueued > 0) {
    console.info(
      `[snapshot:trigger:source] enqueued ${enqueued}/${VENUE_STRIP_LOCATIONS.length} venue(s) for ${businessDate} (source freshness)`,
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
  const { built, errors } = await buildDailyOpsSnapshotRange({
    startDate,
    endDate,
    locationId,
    forceReopenSealed: true,
  })
  console.info(
    `[snapshot:trigger] materialized ${built} snapshot(s), errors=${errors}, business_date ${startDate}..${endDate}`,
  )
  return { built, errors }
}

export type IntegrationPipelineSnapshotResult = {
  startDate: string
  endDate: string
  built: number
  errors: number
}

/**
 * Final step of integration pipeline: resync + aggregation → sealed snapshot refresh → JSON bundle cache.
 * Always reopens sealed days (`forceReopenSealed`) so warm-tier fixes propagate to Revenue GET paths.
 */
export async function materializeIntegrationPipelineSnapshots(
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<IntegrationPipelineSnapshotResult> {
  const { built, errors } = await rebuildSnapshotsForBusinessDateRange(
    db,
    startDate,
    endDate,
    locationId,
  )
  console.info(
    `[integration:pipeline] snapshots+JSON ${startDate}..${endDate} built=${built} errors=${errors}`,
  )
  return { startDate, endDate, built, errors }
}

function snapKey(businessDate: string, locationId: string): string {
  return `${businessDate}:::${locationId}`
}

export type SnapshotGapVenueDay = {
  businessDate: string
  locationId: string
  locationName: string
  reasons: Array<
    | 'missing_master'
    | 'missing_revenue_snapshot'
    | 'missing_labor_snapshot'
    | 'revenue_snapshot_empty'
  >
}

export type SnapshotGapScanOpts = {
  startDate?: string
  endDate?: string
  /** Used when startDate omitted — days through endDate (default 60). */
  lookbackDays?: number
  locationIds?: string[]
}

function resolveGapScanWindow(opts?: SnapshotGapScanOpts): { startDate: string; endDate: string } {
  const endDate = opts?.endDate ?? amsterdamOpenRegisterBusinessDateYmd()
  const startDate =
    opts?.startDate ??
    addCalendarDaysYmd(endDate, -((opts?.lookbackDays ?? SNAPSHOT_GAP_LOOKBACK_DAYS) - 1))
  return { startDate, endDate }
}

/** Venue-days with warm-tier or partial snapshot data that need buildDailyOpsSnapshot. */
export async function findSnapshotGapVenueDays(
  db: Db,
  opts?: SnapshotGapScanOpts,
): Promise<SnapshotGapVenueDay[]> {
  const { startDate, endDate } = resolveGapScanWindow(opts)
  const locIds = opts?.locationIds ?? VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const locName = new Map(VENUE_STRIP_LOCATIONS.map((v) => [v.locationId, v.locationName]))
  const dateFilter = { $gte: startDate, $lte: endDate }
  const borkSuffix = resolveBorkAggReadSuffix()
  const borkDaysColl = `bork_business_days${borkSuffix}`

  const [masterRows, revenueRows, laborRows, borkRows, eitjeRows] = await Promise.all([
    db
      .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master)
      .find({ businessDate: dateFilter, locationId: { $in: locIds } })
      .project({ businessDate: 1, locationId: 1 })
      .toArray(),
    db
      .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection)
      .find({ businessDate: dateFilter, locationId: { $in: locIds } })
      .project({ businessDate: 1, locationId: 1, totals: 1 })
      .toArray(),
    db
      .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection)
      .find({ businessDate: dateFilter, locationId: { $in: locIds } })
      .project({ businessDate: 1, locationId: 1 })
      .toArray(),
    db
      .collection(borkDaysColl)
      .find({
        business_date: dateFilter,
        locationId: { $in: locIds.map((id) => new ObjectId(id)) },
      })
      .project({ business_date: 1, locationId: 1, total_revenue_ex_vat: 1 })
      .toArray(),
    db
      .collection('eitje_time_registration_aggregation')
      .find({ period: dateFilter, locationId: { $in: locIds } })
      .project({ period: 1, locationId: 1, hours: 1 })
      .toArray(),
  ])

  const masterKeys = new Set(
    masterRows.map((row) => snapKey(String(row.businessDate), String(row.locationId))),
  )
  const revenueByKey = new Map<string, number>()
  for (const row of revenueRows) {
    const totals = row.totals as { ex_vat?: number } | undefined
    revenueByKey.set(
      snapKey(String(row.businessDate), String(row.locationId)),
      Number(totals?.ex_vat ?? 0),
    )
  }
  const laborKeys = new Set(
    laborRows.map((row) => snapKey(String(row.businessDate), String(row.locationId))),
  )

  const gapMap = new Map<string, SnapshotGapVenueDay>()

  function noteGap(
    businessDate: string,
    locationId: string,
    reason: SnapshotGapVenueDay['reasons'][number],
  ) {
    const key = snapKey(businessDate, locationId)
    const existing = gapMap.get(key)
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason)
      return
    }
    gapMap.set(key, {
      businessDate,
      locationId,
      locationName: locName.get(locationId) ?? locationId,
      reasons: [reason],
    })
  }

  for (const row of borkRows) {
    const businessDate = String(row.business_date)
    const locationId = String(row.locationId)
    const borkEx = Number(row.total_revenue_ex_vat ?? 0)
    if (borkEx <= REV_EPS) continue
    const key = snapKey(businessDate, locationId)
    const snapEx = revenueByKey.get(key)
    if (snapEx == null) noteGap(businessDate, locationId, 'missing_revenue_snapshot')
    else if (snapEx <= REV_EPS) noteGap(businessDate, locationId, 'revenue_snapshot_empty')
    if (!masterKeys.has(key)) noteGap(businessDate, locationId, 'missing_master')
  }

  for (const row of eitjeRows) {
    const hours = Number(row.hours ?? 0)
    if (hours <= REV_EPS) continue
    const businessDate = String(row.period)
    const locationId = String(row.locationId)
    const key = snapKey(businessDate, locationId)
    if (!laborKeys.has(key)) noteGap(businessDate, locationId, 'missing_labor_snapshot')
    if (!masterKeys.has(key)) noteGap(businessDate, locationId, 'missing_master')
  }

  for (const row of revenueRows) {
    const businessDate = String(row.businessDate)
    const locationId = String(row.locationId)
    const key = snapKey(businessDate, locationId)
    if (!masterKeys.has(key)) noteGap(businessDate, locationId, 'missing_master')
  }

  return Array.from(gapMap.values()).sort((a, b) =>
    a.businessDate === b.businessDate
      ? a.locationId.localeCompare(b.locationId)
      : a.businessDate.localeCompare(b.businessDate),
  )
}

/** Business dates with at least one venue-day gap (deduped). */
export async function findWarmTierSnapshotGapDates(
  db: Db,
  opts?: SnapshotGapScanOpts,
): Promise<string[]> {
  const gaps = await findSnapshotGapVenueDays(db, opts)
  return [...new Set(gaps.map((g) => g.businessDate))].sort()
}

/** Historical cron safety net: rebuild snapshot masters for warm-tier orphans outside the sync window. */
export async function materializeSnapshotGaps(
  db: Db,
  opts?: SnapshotGapScanOpts,
): Promise<(IntegrationPipelineSnapshotResult & { gapDates: string[] }) | null> {
  const gapVenueDays = await findSnapshotGapVenueDays(db, opts)
  const gapDates = [...new Set(gapVenueDays.map((g) => g.businessDate))].sort()
  if (gapDates.length === 0) return null

  let built = 0
  let errors = 0
  for (const businessDate of gapDates) {
    const dayResult = await buildDailyOpsSnapshotRange({
      startDate: businessDate,
      endDate: businessDate,
      forceReopenSealed: true,
    })
    built += dayResult.built
    errors += dayResult.errors
  }

  const startDate = gapDates[0]!
  const endDate = gapDates[gapDates.length - 1]!
  console.info(
    `[snapshot:trigger] gap backfill ${gapDates.length} orphan day(s) ${startDate}..${endDate} built=${built} errors=${errors}`,
  )
  return { startDate, endDate, built, errors, gapDates }
}

/** Historical job tail: sync window + gap scan (60d through yesterday). */
export async function materializeHistoricalPipelineSnapshots(
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<{
  window: IntegrationPipelineSnapshotResult
  gaps: (IntegrationPipelineSnapshotResult & { gapDates: string[] }) | null
}> {
  const window = await materializeIntegrationPipelineSnapshots(db, startDate, endDate, locationId)
  const gaps = await materializeSnapshotGaps(db, { endDate })
  return { window, gaps }
}
