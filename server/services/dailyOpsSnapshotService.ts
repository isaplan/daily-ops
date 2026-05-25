/**
 * @registry-id: dailyOpsSnapshotService
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-25T12:25:00.000Z
 * @description: Reads aggregated Bork + Eitje + inbox collections, writes denormalized
 *   daily snapshots (master + revenue section + labor section per location × businessDate).
 *   Idempotent, event-driven, never touches raw data.
 * @last-fix: [2026-05-25] Snapshot sealed on cron_hour 7 OR 8 (morning final); was incorrectly checking === 8 only.
 * @adr-ref: ADR-004 (Daily Ops snapshot = authoritative revenue source)
 *
 * @architecture:
 *   - No raw data reads — aggregated collections only (bork_business_days, bork_sales_by_hour,
 *     eitje_time_registration_aggregation, inbox-bork-basis-report).
 *   - Denormalization: locationName / teamName / userName copied at write time (no $lookup on read).
 *   - Business day = 08:00 Amsterdam → 07:59:59 next ISO day.
 *   - Eitje period == business_date directly (no shifts start 00:00–07:59 per ops pattern).
 *   - Lead revenue source decided in buildRevenueSection (inbox-sealed > inbox-latest > bork).
 *   - status: 'partial' until morning final (cron 7 or 8) inbox row received, then sealDailyOpsSnapshot() flips to 'final'.
 *   - Idempotent: same input → same output modulo lastBuiltAt / sealedAt.
 *
 * @exports-to:
 *   ✓ server/services/eitjeSyncService.ts (enqueue rebuilds after agg)
 *   ✓ server/services/inboxProcessService.ts (seal on 08:05 basis-report upsert)
 *   ✓ server/services/basisReportBackfillService.ts (same)
 *   ✓ server/api/daily-ops/* (read endpoints — Phase A.3)
 *   ✓ scripts/validate-snapshot-phase-a1.ts (driver for live data validation)
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { getDb } from '../utils/db'
import {
  DAILY_OPS_SNAPSHOT_COLLECTIONS,
  type DailyOpsSnapshotMaster,
} from '../../types/daily-ops-snapshot'
import { buildRevenueSection } from '../utils/dailyOpsSnapshot/buildRevenueSection'
import { buildRevenueHourlySection } from '../utils/dailyOpsSnapshot/buildRevenueHourlySection'
import { buildRevenueProductsSection } from '../utils/dailyOpsSnapshot/buildRevenueProductsSection'
import { buildRevenueTablesSection } from '../utils/dailyOpsSnapshot/buildRevenueTablesSection'
import { buildRevenueWorkersSection } from '../utils/dailyOpsSnapshot/buildRevenueWorkersSection'
import { buildLaborSection } from '../utils/dailyOpsSnapshot/buildLaborSection'
import { buildCards } from '../utils/dailyOpsSnapshot/buildCards'
import { resolveSources } from '../utils/dailyOpsSnapshot/resolveSources'
import { registerSnapshotRunner } from '../utils/dailyOpsSnapshot/jobCoalescer'

const DEBUG = String(process.env.DEBUG ?? '').includes('snapshot:build')

async function resolveLocationName(db: Db, locationId: string): Promise<string> {
  if (!ObjectId.isValid(locationId)) return ''
  const oid = new ObjectId(locationId)
  const mapping = await db
    .collection('bork_unified_location_mapping')
    .findOne({ unifiedLocationId: oid }, { projection: { unifiedLocationName: 1 } })
  if (mapping?.unifiedLocationName) return mapping.unifiedLocationName as string
  const fallback = await db.collection('locations').findOne({ _id: oid }, { projection: { name: 1 } })
  return (fallback?.name as string | undefined) ?? ''
}

async function listLocationIdsForDate(db: Db, businessDate: string): Promise<string[]> {
  const [bork, eitje] = await Promise.all([
    db.collection('bork_business_days').distinct('locationId', { business_date: businessDate }),
    db.collection('eitje_time_registration_aggregation').distinct('locationId', { period: businessDate }),
  ])
  const set = new Set<string>()
  for (const id of bork) set.add(String(id))
  for (const id of eitje) set.add(String(id))
  return Array.from(set)
}

export type BuildSnapshotInput = {
  businessDate: string
  locationId?: string
}

export type BuildSnapshotResult = {
  success: boolean
  built: Array<{ locationId: string; locationName: string }>
  errors: Array<{ locationId: string; error: string }>
}

export async function buildDailyOpsSnapshot(input: BuildSnapshotInput): Promise<BuildSnapshotResult> {
  const db = await getDb()
  const { businessDate } = input
  const locations = input.locationId ? [input.locationId] : await listLocationIdsForDate(db, businessDate)

  if (DEBUG) console.info(`[snapshot:build] ${businessDate} | locations=${locations.length}`)

  const out: BuildSnapshotResult = { success: true, built: [], errors: [] }
  for (const locationId of locations) {
    try {
      const locationName = await resolveLocationName(db, locationId)
      if (!locationName && DEBUG) {
        console.warn(`[snapshot:build] ${businessDate} ${locationId} | missing locationName`)
      }
      const buildInput = { businessDate, locationId, locationName }
      const [revenue, labor, sources, revenueHourly, revenueProducts, revenueTables, revenueWorkers] =
        await Promise.all([
          buildRevenueSection(db, buildInput),
          buildLaborSection(db, buildInput),
          resolveSources(db, businessDate, locationId),
          buildRevenueHourlySection(db, buildInput),
          buildRevenueProductsSection(db, buildInput),
          buildRevenueTablesSection(db, buildInput),
          buildRevenueWorkersSection(db, buildInput),
        ])
      const cards = buildCards(revenue, labor)

      // Snapshot is "sealed" (final) when we have a morning final Basis report (cron 7 or 8).
      // Both are valid morning-final crons; using === 8 only would miss cron 7 reports.
      const sealed = sources.inbox.cronHour === 7 || sources.inbox.cronHour === 8
      const master: DailyOpsSnapshotMaster = {
        schema_version: 1,
        businessDate,
        locationId,
        locationName,
        status: sealed ? 'final' : 'partial',
        leadRevenueSource: revenue.leadSource,
        cards,
        sources,
        sections: {
          revenue: true,
          labor: true,
          revenueHourly: true,
          revenueProducts: true,
          revenueTables: true,
          revenueWorkers: true,
        },
        lastBuiltAt: new Date(),
        sealedAt: sealed ? new Date() : null,
      }

      const filter = { businessDate, locationId }
      await Promise.all([
        db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master).updateOne(filter, { $set: master }, { upsert: true }),
        db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection).updateOne(filter, { $set: revenue }, { upsert: true }),
        db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection).updateOne(filter, { $set: labor }, { upsert: true }),
        db
          .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueHourlySection)
          .updateOne(filter, { $set: revenueHourly }, { upsert: true }),
        db
          .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection)
          .updateOne(filter, { $set: revenueProducts }, { upsert: true }),
        db
          .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueTablesSection)
          .updateOne(filter, { $set: revenueTables }, { upsert: true }),
        db
          .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueWorkersSection)
          .updateOne(filter, { $set: revenueWorkers }, { upsert: true }),
      ])

      if (DEBUG) {
        console.info(
          `[snapshot:build] ${businessDate} ${locationName} | wrote master+revenue+labor | status=${master.status} leadSource=${master.leadRevenueSource}`
        )
      }
      out.built.push({ locationId, locationName })
    } catch (e) {
      out.success = false
      out.errors.push({ locationId, error: e instanceof Error ? e.message : String(e) })
      console.error(`[snapshot:build] FAILED ${businessDate} ${locationId}`, e)
    }
  }

  return out
}

export async function buildDailyOpsSnapshotRange(input: {
  startDate: string
  endDate: string
  locationId?: string
}): Promise<{ built: number; errors: number }> {
  let built = 0
  let errors = 0
  let cursor = input.startDate
  while (cursor <= input.endDate) {
    const r = await buildDailyOpsSnapshot({ businessDate: cursor, locationId: input.locationId })
    built += r.built.length
    errors += r.errors.length
    // increment one day
    const [y, m, d] = cursor.split('-').map(Number)
    const next = new Date(Date.UTC(y!, m! - 1, d! + 1))
    cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
  }
  return { built, errors }
}

export async function sealDailyOpsSnapshot(input: { businessDate: string; locationId: string }): Promise<{ sealed: boolean; error?: string }> {
  try {
    const r = await buildDailyOpsSnapshot(input)
    if (r.errors.length > 0) return { sealed: false, error: r.errors[0]!.error }
    const db = await getDb()
    await db
      .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master)
      .updateOne({ businessDate: input.businessDate, locationId: input.locationId }, { $set: { status: 'final', sealedAt: new Date() } })
    if (DEBUG) console.info(`[snapshot:seal] ${input.businessDate} ${input.locationId} sealed`)
    return { sealed: true }
  } catch (e) {
    return { sealed: false, error: e instanceof Error ? e.message : String(e) }
  }
}

registerSnapshotRunner(async (key) => {
  await buildDailyOpsSnapshot(key)
})
