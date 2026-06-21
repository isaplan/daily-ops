/**
 * @registry-id: dailyOpsSnapshotService
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-06-18T00:00:00.000Z
 * @last-fix: [2026-06-18] Reopen sealed snapshots when warm tier is newer; preserve revenue hourly on rewrite
 *   Prior: [2026-06-05] Pre-generate bundle JSON cache after snapshot builds complete
 * @adr-ref: ADR-004, ADR-006, ADR-007
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
  type DailyOpsSnapshotRevenueByOrderTimeSection,
  type DailyOpsSnapshotRevenueHourlySection,
  type DailyOpsSnapshotRevenueProductsSection,
  type DailyOpsSnapshotRevenueSection,
  type DailyOpsSnapshotRevenueTablesSection,
  type DailyOpsSnapshotRevenueWorkersSection,
} from '../../types/daily-ops-snapshot'
import { buildRevenueSection } from '../utils/dailyOpsSnapshot/buildRevenueSection'
import { buildRevenueHourlySection } from '../utils/dailyOpsSnapshot/buildRevenueHourlySection'
import { buildRevenueProductsSection } from '../utils/dailyOpsSnapshot/buildRevenueProductsSection'
import { buildRevenueTablesSection } from '../utils/dailyOpsSnapshot/buildRevenueTablesSection'
import { buildRevenueWorkersSection } from '../utils/dailyOpsSnapshot/buildRevenueWorkersSection'
import { buildRevenueByOrderTimeSection } from '../utils/dailyOpsSnapshot/buildRevenueByOrderTimeSection'
import { buildLaborSection } from '../utils/dailyOpsSnapshot/buildLaborSection'
import { buildCards } from '../utils/dailyOpsSnapshot/buildCards'
import { resolveSources } from '../utils/dailyOpsSnapshot/resolveSources'
import { registerSnapshotRunner } from '../utils/dailyOpsSnapshot/jobCoalescer'
import {
  writeRevenueBenchmarkAllLocations,
  writeRevenueBenchmarkForLocation,
} from '../utils/dailyOpsRevenue/revenueBenchmark'
import { runPostSealRetention } from '../utils/dailyOpsBlob/runPostSealRetention'
import { preGenerateBundleForDate, preGenerateBundlesForRange } from '../utils/dailyOpsSnapshot/preGenerateBundleCache'
import type { SourcesFingerprint } from '../utils/dailyOpsSnapshot/resolveSources'

const runtimeProcess = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}
const DEBUG = String(runtimeProcess.process?.env?.DEBUG ?? '').includes('snapshot:build')

function sumHourlyExVat(slots: DailyOpsSnapshotRevenueSection['hourly'] | undefined): number {
  return (slots ?? []).reduce((sum, slot) => sum + Number(slot.revenue?.ex_vat ?? 0), 0)
}

function sourcesNewerThanBuild(
  sources: SourcesFingerprint,
  lastBuiltAt: Date | string | null | undefined,
): boolean {
  if (!lastBuiltAt) return false
  const builtMs = new Date(lastBuiltAt).getTime()
  for (const fp of [sources.bork, sources.eitje, sources.inbox]) {
    const syncMs = fp.lastSyncAt ? new Date(fp.lastSyncAt).getTime() : 0
    if (syncMs > builtMs) return true
  }
  return false
}

async function preserveSealedFatSections(
  db: Db,
  filter: { businessDate: string; locationId: string },
  sections: {
    revenue: DailyOpsSnapshotRevenueSection
    revenueHourly: DailyOpsSnapshotRevenueHourlySection
    revenueProducts: DailyOpsSnapshotRevenueProductsSection
    revenueTables: DailyOpsSnapshotRevenueTablesSection
    revenueWorkers: DailyOpsSnapshotRevenueWorkersSection
    revenueByOrderTime: DailyOpsSnapshotRevenueByOrderTimeSection
  },
  flags: {
    hourlyHasData: boolean
    productsHasData: boolean
    tablesHasData: boolean
    workersHasData: boolean
    orderTimeHasData: boolean
  },
): Promise<typeof sections> {
  const [existingRev, existingHourly, existingProducts, existingTables, existingWorkers, existingOrderTime] =
    await Promise.all([
      flags.hourlyHasData
        ? null
        : db.collection<DailyOpsSnapshotRevenueSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection).findOne(filter),
      flags.hourlyHasData
        ? null
        : db
            .collection<DailyOpsSnapshotRevenueHourlySection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueHourlySection)
            .findOne(filter),
      flags.productsHasData
        ? null
        : db
            .collection<DailyOpsSnapshotRevenueProductsSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection)
            .findOne(filter),
      flags.tablesHasData
        ? null
        : db.collection<DailyOpsSnapshotRevenueTablesSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueTablesSection).findOne(filter),
      flags.workersHasData
        ? null
        : db
            .collection<DailyOpsSnapshotRevenueWorkersSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueWorkersSection)
            .findOne(filter),
      flags.orderTimeHasData
        ? null
        : db
            .collection<DailyOpsSnapshotRevenueByOrderTimeSection>(
              DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueByOrderTimeSection,
            )
            .findOne(filter),
    ])

  const out = { ...sections }

  if (existingRev && sumHourlyExVat(out.revenue.hourly) <= 0 && sumHourlyExVat(existingRev.hourly) > 0) {
    out.revenue = {
      ...out.revenue,
      hourly: existingRev.hourly,
      orderHourly: existingRev.orderHourly,
    }
  }
  if (existingHourly && sumHourlyExVat(out.revenueHourly.hourly) <= 0 && sumHourlyExVat(existingHourly.hourly) > 0) {
    out.revenueHourly = {
      ...out.revenueHourly,
      hourly: existingHourly.hourly,
      orderHourly: existingHourly.orderHourly,
    }
  }
  if (existingProducts && !flags.productsHasData) {
    out.revenueProducts = { ...out.revenueProducts, ...existingProducts, lastBuiltAt: new Date() }
  }
  if (existingTables && !flags.tablesHasData) {
    out.revenueTables = { ...out.revenueTables, ...existingTables, lastBuiltAt: new Date() }
  }
  if (existingWorkers && !flags.workersHasData) {
    out.revenueWorkers = { ...out.revenueWorkers, ...existingWorkers, lastBuiltAt: new Date() }
  }
  if (existingOrderTime && !flags.orderTimeHasData) {
    out.revenueByOrderTime = { ...out.revenueByOrderTime, ...existingOrderTime, lastBuiltAt: new Date() }
  }

  return out
}

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
  /** Backfill / cron rebuilds: refresh fat sections when warm tier is newer than last build. */
  forceReopenSealed?: boolean
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

      // Read existing master before building so we know if it's already sealed.
      // Sealed snapshots must not have their fat Bork sections overwritten with
      // empty data (those collections are purged after seal per ADR-006).
      const existingMaster = await db
        .collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master)
        .findOne({ businessDate, locationId })
      const alreadySealed = (existingMaster as { status?: string } | null)?.status === 'final'

      // Build revenue first so headline is available for worker/table scaling.
      let revenue = await buildRevenueSection(db, buildInput)
      const headlineExVat = revenue.totals.ex_vat

      let [labor, sources, revenueHourly, revenueProducts, revenueTables, revenueWorkers, revenueByOrderTime] =
        await Promise.all([
          buildLaborSection(db, buildInput),
          resolveSources(db, businessDate, locationId),
          buildRevenueHourlySection(db, buildInput),
          buildRevenueProductsSection(db, buildInput),
          buildRevenueTablesSection(db, buildInput, headlineExVat),
          buildRevenueWorkersSection(db, buildInput, headlineExVat),
          buildRevenueByOrderTimeSection(db, buildInput),
        ])

      const warmTierNewer = sourcesNewerThanBuild(sources, existingMaster?.lastBuiltAt)
      const reopenSealed = Boolean(input.forceReopenSealed || warmTierNewer)

      let hourlyHasData = revenueHourly.hourly.some((s) => s.revenue.ex_vat > 0)
        || (revenueHourly.orderHourly ?? []).some((s) => s.revenue.ex_vat > 0)
      let productsHasData = revenueProducts.categories.length > 0 || revenueProducts.products.length > 0
      let tablesHasData = revenueTables.tables.length > 0
      let workersHasData = revenueWorkers.workers.length > 0
      let orderTimeHasData = revenueByOrderTime.hourly.some((s) => s.revenue.ex_vat > 0)

      if (alreadySealed && !reopenSealed) {
        const preserved = await preserveSealedFatSections(
          db,
          { businessDate, locationId },
          { revenue, revenueHourly, revenueProducts, revenueTables, revenueWorkers, revenueByOrderTime },
          { hourlyHasData, productsHasData, tablesHasData, workersHasData, orderTimeHasData },
        )
        revenue = preserved.revenue
        revenueHourly = preserved.revenueHourly
        revenueProducts = preserved.revenueProducts
        revenueTables = preserved.revenueTables
        revenueWorkers = preserved.revenueWorkers
        revenueByOrderTime = preserved.revenueByOrderTime

        hourlyHasData = revenueHourly.hourly.some((s) => s.revenue.ex_vat > 0)
          || (revenueHourly.orderHourly ?? []).some((s) => s.revenue.ex_vat > 0)
        productsHasData = revenueProducts.categories.length > 0 || revenueProducts.products.length > 0
        tablesHasData = revenueTables.tables.length > 0
        workersHasData = revenueWorkers.workers.length > 0
        orderTimeHasData = revenueByOrderTime.hourly.some((s) => s.revenue.ex_vat > 0)
      }

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
          revenueByOrderTime: true,
        },
        lastBuiltAt: new Date(),
        sealedAt: sealed ? new Date() : null,
      }

      // For fat Bork sections: skip upsert when sealed and new build is empty (Bork purged).
      // Reopen path (warm tier newer / forceReopenSealed) writes when new data exists.
      const writeHourly = !alreadySealed || hourlyHasData || (reopenSealed && hourlyHasData)
      const writeProducts = !alreadySealed || productsHasData || (reopenSealed && productsHasData)
      const writeTables = !alreadySealed || tablesHasData || (reopenSealed && tablesHasData)
      const writeWorkers = !alreadySealed || workersHasData || (reopenSealed && workersHasData)
      const writeOrderTime = !alreadySealed || orderTimeHasData || (reopenSealed && orderTimeHasData)

      const filter = { businessDate, locationId }
      await Promise.all([
        db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master).updateOne(filter, { $set: master }, { upsert: true }),
        db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection).updateOne(filter, { $set: revenue }, { upsert: true }),
        db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection).updateOne(filter, { $set: labor }, { upsert: true }),
        ...(writeHourly
          ? [db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueHourlySection).updateOne(filter, { $set: revenueHourly }, { upsert: true })]
          : []),
        ...(writeProducts
          ? [db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection).updateOne(filter, { $set: revenueProducts }, { upsert: true })]
          : []),
        ...(writeTables
          ? [db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueTablesSection).updateOne(filter, { $set: revenueTables }, { upsert: true })]
          : []),
        ...(writeWorkers
          ? [db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueWorkersSection).updateOne(filter, { $set: revenueWorkers }, { upsert: true })]
          : []),
        ...(writeOrderTime
          ? [db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueByOrderTimeSection).updateOne(filter, { $set: revenueByOrderTime }, { upsert: true })]
          : []),
      ])

      if (DEBUG) {
        console.info(
          `[snapshot:build] ${businessDate} ${locationName} | wrote master+revenue+labor | status=${master.status} leadSource=${master.leadRevenueSource}`
        )
      }

      if (sealed) {
        await writeRevenueBenchmarkForLocation(db, businessDate, locationId)
        // Pre-generate bundle cache for instant page loads
        await preGenerateBundleForDate(db, businessDate, locationId)
        await preGenerateBundleForDate(db, businessDate, 'all')
      }
      out.built.push({ locationId, locationName })
    } catch (e) {
      out.success = false
      out.errors.push({ locationId, error: e instanceof Error ? e.message : String(e) })
      console.error(`[snapshot:build] FAILED ${businessDate} ${locationId}`, e)
    }
  }

  if (out.built.length > 0) {
    await writeRevenueBenchmarkAllLocations(db, businessDate)
  }

  return out
}

export async function buildDailyOpsSnapshotRange(input: {
  startDate: string
  endDate: string
  locationId?: string
  forceReopenSealed?: boolean
}): Promise<{ built: number; errors: number }> {
  const db = await getDb()
  let built = 0
  let errors = 0
  const locationIds: string[] = []
  let cursor = input.startDate
  while (cursor <= input.endDate) {
    const r = await buildDailyOpsSnapshot({
      businessDate: cursor,
      locationId: input.locationId,
      forceReopenSealed: input.forceReopenSealed ?? true,
    })
    built += r.built.length
    errors += r.errors.length
    for (const { locationId } of r.built) {
      if (!locationIds.includes(locationId)) locationIds.push(locationId)
    }
    // increment one day
    const [y, m, d] = cursor.split('-').map(Number)
    const next = new Date(Date.UTC(y!, m! - 1, d! + 1))
    cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
  }
  
  // Pre-generate bundle cache for all sealed days in range
  if (locationIds.length > 0) {
    await preGenerateBundlesForRange(db, input.startDate, input.endDate, [...locationIds, 'all'])
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
    await runPostSealRetention(db, input.businessDate, input.locationId)
    await preGenerateBundleForDate(db, input.businessDate, input.locationId)
    await preGenerateBundleForDate(db, input.businessDate, 'all')
    if (DEBUG) console.info(`[snapshot:seal] ${input.businessDate} ${input.locationId} sealed`)
    return { sealed: true }
  } catch (e) {
    return { sealed: false, error: e instanceof Error ? e.message : String(e) }
  }
}

registerSnapshotRunner(async (key) => {
  await buildDailyOpsSnapshot(key)
})
