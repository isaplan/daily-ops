/**
 * @registry-id: dailyOpsVenueStrip
 * @created: 2026-05-16T23:30:00.000Z
 * @last-modified: 2026-05-26T02:00:00.000Z
 * @description: Builds per-venue KPI cards for the Daily Ops venue strip (3 fixed locations, single day).
 * @last-fix: [2026-05-26] Recompute operational labor buckets from workers when snapshot buckets disagree.
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/venue-strip.get.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type {
  VenueStripCardDto,
  VenueStripLaborRowDto,
  VenueStripResponseDto,
  VenueStripTeamBucket,
  VenueStripWorkerLineDto,
} from '../../types/daily-ops-dashboard'
import {
  DAILY_OPS_SNAPSHOT_COLLECTIONS,
  type DailyOpsSnapshotLaborSection,
  type DailyOpsSnapshotRevenueProductsSection,
  type DailyOpsSnapshotRevenueSection,
} from '../../types/daily-ops-snapshot'
import type { DailyOpsMetricsContext } from './dailyOpsDashboardMetrics'
import { rollupFoodBeverageFromCategories } from './borkFoodBeverageSplit'
import { resolveDailyOpsHeadlineRevenue } from './dailyOpsHeadlineRevenue'
import { bucketTeamFromName } from './dailyOpsTeamBucket'
import {
  aggRowsUseLegacyGewerktSchema,
  allocateOperationalTeamLabor,
  resolveRowGewerktSlice,
  type VenueLaborSlice,
} from './eitjeVenueLaborRollup'
import {
  enrichEitjeAggRowsFromMembers,
  enrichSnapshotLaborWorkersFromMembers,
} from './eitjeAggCompensationEnrich'
import { workersFromEitjeAggRows, workersFromSnapshot } from './dailyOpsVenueStripWorkers'

export const VENUE_STRIP_LOCATIONS = [
  { locationId: '69d6cfa63d2adf93b79d1ae7', locationName: 'Van Kinsbergen' },
  { locationId: '69d6cfa63d2adf93b79d1ae6', locationName: 'Bar Bea' },
  { locationId: '69d6cfa73d2adf93b79d1ae8', locationName: "l'Amour Toujours" },
] as const

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function emptyLaborRow (): VenueStripLaborRowDto {
  return { workers: 0, hours: 0, wages: 0, loaded: 0, laborPctOfRevenue: null }
}

function emptyLaborBlock (): VenueStripCardDto['labor'] {
  const row = emptyLaborRow()
  return {
    all: { ...row },
    gewerkt: { ...row },
    keuken: { ...row },
    bediening: { ...row },
    other: { ...row },
  }
}

function withLaborPct (row: VenueStripLaborRowDto, revenue: number): VenueStripLaborRowDto {
  return {
    ...row,
    laborPctOfRevenue: revenue > 0 ? round2((row.loaded / revenue) * 100) : null,
  }
}

function enrichLaborWithPct (
  labor: VenueStripCardDto['labor'],
  revenue: number
): VenueStripCardDto['labor'] {
  return {
    all: withLaborPct(labor.all, revenue),
    gewerkt: withLaborPct(labor.gewerkt, revenue),
    keuken: withLaborPct(labor.keuken, revenue),
    bediening: withLaborPct(labor.bediening, revenue),
    other: withLaborPct(labor.other, revenue),
  }
}

function finalizeLaborOther (
  labor: VenueStripCardDto['labor'],
  workers: VenueStripWorkerLineDto[],
): void {
  const overigIds = new Set(
    workers.filter((w) => w.bucket === 'overig' && w.userId).map((w) => w.userId),
  )
  labor.other = {
    hours: round2(Math.max(0, labor.all.hours - labor.gewerkt.hours)),
    wages: round2(Math.max(0, labor.all.wages - labor.gewerkt.wages)),
    loaded: round2(Math.max(0, labor.all.loaded - labor.gewerkt.loaded)),
    workers: overigIds.size,
    laborPctOfRevenue: null,
  }
}

type VenueStripLaborBundle = {
  labor: VenueStripCardDto['labor']
  workers: VenueStripWorkerLineDto[]
}

function productivityPerHour (revenue: number, hours: number): number | null {
  if (hours <= 0 || revenue <= 0) return null
  return round2(revenue / hours)
}

function eitjeLocationMatch (locationId: string): unknown {
  try {
    const oid = new ObjectId(locationId)
    return { $in: [oid, locationId] }
  } catch {
    return locationId
  }
}

function snapshotHasOperationalLabor (doc: DailyOpsSnapshotLaborSection | null): boolean {
  if (!doc) return false
  const g =
    doc.operational?.gewerkt?.hours ??
    doc.totals_gewerkt?.hours ??
    0
  if (g > 0) return true
  if (Number(doc.totals?.hours ?? 0) > 0) {
    for (const t of doc.teams ?? []) {
      if (Number(t.gewerkt?.hours ?? t.hours ?? 0) > 0) return true
    }
  }
  return false
}

function contractsByTeamHasRows (c: VenueStripCardDto['contractsByTeam']): boolean {
  return c.keuken.length + c.bediening.length + c.other.length > 0
}

function addVenueLaborSlice (target: VenueStripLaborRowDto, source: VenueLaborSlice): void {
  target.hours += source.hours
  target.wages += source.wages
  target.loaded += source.loaded
}

function finalizeVenueLaborRow (row: VenueStripLaborRowDto): void {
  row.hours = round2(row.hours)
  row.wages = round2(row.wages)
  row.loaded = round2(row.loaded)
  row.laborPctOfRevenue = null
}

function laborRowFromCostPair (
  pair: { hours: number; wage_cost: number; loaded_cost: number },
  workers = 0
): VenueStripLaborRowDto {
  return {
    workers,
    hours: round2(Number(pair.hours ?? 0)),
    wages: round2(Number(pair.wage_cost ?? 0)),
    loaded: round2(Number(pair.loaded_cost ?? 0)),
    laborPctOfRevenue: null,
  }
}

function laborRowFromWorkerLines (
  workers: VenueStripWorkerLineDto[],
  bucket: VenueStripWorkerLineDto['bucket'],
): VenueStripLaborRowDto {
  const rows = workers.filter((w) => w.bucket === bucket)
  return {
    workers: new Set(rows.map((w) => w.userId).filter(Boolean)).size,
    hours: round2(rows.reduce((sum, w) => sum + Number(w.hours ?? 0), 0)),
    wages: round2(rows.reduce((sum, w) => sum + Number(w.wages ?? 0), 0)),
    loaded: round2(rows.reduce((sum, w) => sum + Number(w.wages ?? 0), 0)),
    laborPctOfRevenue: null,
  }
}

function operationalLooksStale (
  doc: DailyOpsSnapshotLaborSection,
  workers: VenueStripWorkerLineDto[],
): boolean {
  const workerKeuken = workers
    .filter((w) => w.bucket === 'keuken')
    .reduce((sum, w) => sum + Number(w.hours ?? 0), 0)
  const workerBediening = workers
    .filter((w) => w.bucket === 'bediening')
    .reduce((sum, w) => sum + Number(w.hours ?? 0), 0)
  const opKeuken = Number(doc.operational?.keuken?.hours ?? 0)
  const opBediening = Number(doc.operational?.bediening?.hours ?? 0)
  const tolerance = 0.25
  return (
    (workerKeuken > 0.05 && opKeuken <= 0.05) ||
    (workerBediening > 0.05 && opBediening <= 0.05) ||
    Math.abs(workerKeuken - opKeuken) > tolerance ||
    Math.abs(workerBediening - opBediening) > tolerance
  )
}

async function resolveVenueStripLabor (
  db: Db,
  businessDate: string,
  locationId: string,
  snapLabor: DailyOpsSnapshotLaborSection | null,
): Promise<VenueStripLaborBundle> {
  if (snapshotHasOperationalLabor(snapLabor)) {
    return laborFromSnapshot(db, snapLabor)
  }
  const fromAgg = await laborFromEitjeAgg(db, businessDate, locationId)
  if (fromAgg.labor.gewerkt.hours > 0 || fromAgg.labor.all.hours > 0) return fromAgg
  return laborFromSnapshot(db, snapLabor)
}

async function laborFromSnapshot (
  db: Db,
  doc: DailyOpsSnapshotLaborSection | null,
): Promise<VenueStripLaborBundle> {
  await enrichSnapshotLaborWorkersFromMembers(db, doc?.workers as Array<Record<string, unknown>> | undefined)
  const workerBuckets: Record<VenueStripTeamBucket, Set<string>> = {
    keuken: new Set(),
    bediening: new Set(),
    other: new Set(),
  }
  const labor = emptyLaborBlock()
  const workers = workersFromSnapshot(doc)

  if (!doc) {
    finalizeLaborOther(labor, workers)
    return { labor, workers }
  }

  for (const w of doc.workers ?? []) {
    const bucket = bucketTeamFromName(String(w.teamName ?? ''))
    const uid = String(w.userId ?? '')
    if (uid) workerBuckets[bucket].add(uid)
  }

  if (doc.operational) {
    labor.all = laborRowFromCostPair(doc.totals, new Set([
      ...workerBuckets.keuken,
      ...workerBuckets.bediening,
      ...workerBuckets.other,
    ]).size)
    if (operationalLooksStale(doc, workers)) {
      labor.keuken = laborRowFromWorkerLines(workers, 'keuken')
      labor.bediening = laborRowFromWorkerLines(workers, 'bediening')
      labor.gewerkt = {
        workers: new Set(
          workers
            .filter((w) => w.bucket === 'keuken' || w.bucket === 'bediening')
            .map((w) => w.userId)
            .filter(Boolean)
        ).size,
        hours: round2(labor.keuken.hours + labor.bediening.hours),
        wages: round2(labor.keuken.wages + labor.bediening.wages),
        loaded: round2(labor.keuken.loaded + labor.bediening.loaded),
        laborPctOfRevenue: null,
      }
      finalizeLaborOther(labor, workers)
      return { labor, workers }
    }
    labor.gewerkt = laborRowFromCostPair(
      doc.operational.gewerkt,
      new Set([...workerBuckets.keuken, ...workerBuckets.bediening]).size
    )
    labor.keuken = laborRowFromCostPair(doc.operational.keuken, workerBuckets.keuken.size)
    labor.bediening = laborRowFromCostPair(doc.operational.bediening, workerBuckets.bediening.size)
    finalizeLaborOther(labor, workers)
    return { labor, workers }
  }

  for (const t of doc.teams ?? []) {
    const gHours = Number(t.gewerkt?.hours ?? t.hours ?? 0)
    if (gHours <= 0) continue
    const slice: VenueLaborSlice = {
      hours: gHours,
      wages: Number(t.gewerkt?.wage_cost ?? 0),
      loaded: Number(t.gewerkt?.loaded_cost ?? 0),
    }
    const alloc = allocateOperationalTeamLabor(String(t.teamName ?? ''), slice)
    addVenueLaborSlice(labor.keuken, alloc.keuken)
    addVenueLaborSlice(labor.bediening, alloc.bediening)
  }

  labor.all = {
    hours: round2(Number(doc.totals?.hours ?? 0)),
    wages: round2(Number(doc.totals?.wage_cost ?? 0)),
    loaded: round2(Number(doc.totals?.loaded_cost ?? 0)),
    workers: new Set([
      ...workerBuckets.keuken,
      ...workerBuckets.bediening,
      ...workerBuckets.other,
    ]).size,
    laborPctOfRevenue: null,
  }

  const gewTotals = doc.totals_gewerkt
  labor.gewerkt = {
    hours: round2(Number(gewTotals?.hours ?? labor.keuken.hours + labor.bediening.hours)),
    wages: round2(Number(gewTotals?.wage_cost ?? labor.keuken.wages + labor.bediening.wages)),
    loaded: round2(Number(gewTotals?.loaded_cost ?? labor.keuken.loaded + labor.bediening.loaded)),
    workers: new Set([...workerBuckets.keuken, ...workerBuckets.bediening]).size,
    laborPctOfRevenue: null,
  }

  labor.keuken.workers = workerBuckets.keuken.size
  labor.bediening.workers = workerBuckets.bediening.size
  finalizeVenueLaborRow(labor.keuken)
  finalizeVenueLaborRow(labor.bediening)
  finalizeLaborOther(labor, workers)

  return { labor, workers }
}

async function laborFromEitjeAgg (
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<VenueStripLaborBundle> {
  const rows = await db
    .collection('eitje_time_registration_aggregation')
    .find({
      period_type: 'day',
      period: businessDate,
      locationId: eitjeLocationMatch(locationId),
    })
    .toArray()

  await enrichEitjeAggRowsFromMembers(db, rows as Record<string, unknown>[])

  const labor = emptyLaborBlock()
  const allWorkers = new Set<string>()
  const gewerktWorkers: Record<'keuken' | 'bediening', Set<string>> = {
    keuken: new Set(),
    bediening: new Set(),
  }
  const legacyGewerkt = aggRowsUseLegacyGewerktSchema(rows as Record<string, unknown>[])
  const workers = workersFromEitjeAggRows(rows as Record<string, unknown>[])

  for (const r of rows) {
    const hoursAll = Number(r.total_hours ?? 0)
    const wagesAll = Number(r.total_cost ?? 0)
    const loadedAll = Number(r.total_cost_loaded ?? 0)
    labor.all.hours += hoursAll
    labor.all.wages += wagesAll
    labor.all.loaded += loadedAll

    const gewSlice = resolveRowGewerktSlice(r as Record<string, unknown>, legacyGewerkt)
    if (gewSlice) {
      const alloc = allocateOperationalTeamLabor(String(r.team_name ?? ''), gewSlice)
      addVenueLaborSlice(labor.keuken, alloc.keuken)
      addVenueLaborSlice(labor.bediening, alloc.bediening)
      const uid = String(r.userId ?? '')
      if (uid) {
        if (alloc.keuken.hours > 0) gewerktWorkers.keuken.add(uid)
        if (alloc.bediening.hours > 0) gewerktWorkers.bediening.add(uid)
      }
    }

    const uid = String(r.userId ?? '')
    if (uid) allWorkers.add(uid)
  }

  labor.all.workers = allWorkers.size
  finalizeVenueLaborRow(labor.all)
  labor.keuken.workers = gewerktWorkers.keuken.size
  labor.bediening.workers = gewerktWorkers.bediening.size
  finalizeVenueLaborRow(labor.keuken)
  finalizeVenueLaborRow(labor.bediening)
  labor.gewerkt = {
    hours: round2(labor.keuken.hours + labor.bediening.hours),
    wages: round2(labor.keuken.wages + labor.bediening.wages),
    loaded: round2(labor.keuken.loaded + labor.bediening.loaded),
    workers: new Set([...gewerktWorkers.keuken, ...gewerktWorkers.bediening]).size,
    laborPctOfRevenue: null,
  }

  finalizeLaborOther(labor, workers)
  return { labor, workers }
}

async function fetchContractsByTeam (
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<VenueStripCardDto['contractsByTeam']> {
  const rows = (await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      {
        $match: {
          period_type: 'day',
          period: businessDate,
          locationId: eitjeLocationMatch(locationId),
        },
      },
      {
        $lookup: {
          from: 'members',
          let: { uid: { $toString: '$userId' } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: [{ $toString: '$eitje_id' }, '$$uid'] },
                    {
                      $gt: [
                        {
                          $size: {
                            $filter: {
                              input: { $ifNull: ['$eitje_ids', []] },
                              as: 'x',
                              cond: { $eq: [{ $toString: '$$x' }, '$$uid'] },
                            },
                          },
                        },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { contract_type: 1 } },
          ],
          as: '_m',
        },
      },
      {
        $addFields: {
          contractType: { $ifNull: [{ $arrayElemAt: ['$_m.contract_type', 0] }, '-'] },
          teamBucket: {
            $switch: {
              branches: [
                {
                  case: {
                    $eq: [
                      { $toLower: { $trim: { input: { $ifNull: ['$team_name', ''] } } } },
                      'keuken',
                    ],
                  },
                  then: 'keuken',
                },
                {
                  case: {
                    $eq: [
                      { $toLower: { $trim: { input: { $ifNull: ['$team_name', ''] } } } },
                      'bediening',
                    ],
                  },
                  then: 'bediening',
                },
              ],
              default: 'other',
            },
          },
        },
      },
      {
        $group: {
          _id: { teamBucket: '$teamBucket', contractType: '$contractType' },
          staffIds: { $addToSet: { $toString: '$userId' } },
          hours: { $sum: { $ifNull: ['$total_hours', 0] } },
          wages: { $sum: { $ifNull: ['$total_cost', 0] } },
          loaded: { $sum: { $ifNull: ['$total_cost_loaded', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          teamBucket: '$_id.teamBucket',
          contractType: '$_id.contractType',
          workers: {
            $size: {
              $filter: {
                input: '$staffIds',
                as: 'id',
                cond: { $and: [{ $ne: ['$$id', ''] }, { $ne: ['$$id', null] }] },
              },
            },
          },
          hours: { $round: ['$hours', 2] },
          wages: { $round: ['$wages', 2] },
          loaded: { $round: ['$loaded', 2] },
        },
      },
      { $sort: { teamBucket: 1, loaded: -1 } },
    ])
    .toArray()) as {
    teamBucket: VenueStripTeamBucket
    contractType: string
    workers: number
    hours: number
    wages: number
    loaded: number
  }[]

  const out: VenueStripCardDto['contractsByTeam'] = { keuken: [], bediening: [], other: [] }
  for (const r of rows) {
    const bucket = r.teamBucket === 'keuken' || r.teamBucket === 'bediening' ? r.teamBucket : 'other'
    out[bucket].push({
      contractType: String(r.contractType ?? '-'),
      workers: Number(r.workers ?? 0),
      hours: Number(r.hours ?? 0),
      wages: Number(r.wages ?? 0),
      loaded: Number(r.loaded ?? 0),
    })
  }
  return out
}

function contractsByTeamFromSnapshot (
  doc: DailyOpsSnapshotLaborSection | null,
): VenueStripCardDto['contractsByTeam'] {
  const out: VenueStripCardDto['contractsByTeam'] = { keuken: [], bediening: [], other: [] }
  if (!doc?.workers?.length) return out

  type Acc = { workers: Set<string>; hours: number; wages: number; loaded: number }
  const acc = new Map<string, Acc & { teamBucket: VenueStripTeamBucket; contractType: string }>()

  for (const w of doc.workers) {
    const teamBucket = bucketTeamFromName(String(w.teamName ?? ''))
    const contractType = String(w.contractType ?? '—').trim() || '—'
    const key = `${teamBucket}|${contractType}`
    let row = acc.get(key)
    if (!row) {
      row = { teamBucket, contractType, workers: new Set(), hours: 0, wages: 0, loaded: 0 }
      acc.set(key, row)
    }
    const hours = Number(w.hours ?? 0)
    if (hours <= 0) continue
    const uid = String(w.userId ?? '')
    if (uid) row.workers.add(uid)
    row.hours += hours
    row.wages += Number(w.wage_cost ?? 0)
    row.loaded += Number(w.loaded_cost ?? 0)
  }

  for (const row of acc.values()) {
    out[row.teamBucket].push({
      contractType: row.contractType,
      workers: row.workers.size,
      hours: round2(row.hours),
      wages: round2(row.wages),
      loaded: round2(row.loaded),
    })
  }
  for (const bucket of ['keuken', 'bediening', 'other'] as const) {
    out[bucket].sort((a, b) => b.loaded - a.loaded)
  }
  return out
}

function revenueFromSnapshotSections (
  ctx: DailyOpsMetricsContext,
  rev: DailyOpsSnapshotRevenueSection | null,
  products: DailyOpsSnapshotRevenueProductsSection | null,
): { totalRevenue: number; food: number; beverage: number } {
  const snapshotExVat = round2(Number(rev?.totals?.ex_vat ?? 0))
  const apiDayTotal = round2(Number(rev?.borkTotals?.ex_vat ?? 0))
  const inboxExVat =
    rev?.leadSource === 'inbox' && Number(rev.totals?.ex_vat ?? 0) > 0
      ? round2(Number(rev.totals.ex_vat))
      : null
  const split = rollupFoodBeverageFromCategories(
    (products?.categories ?? []).map((c) => ({ name: c.name, revenue_ex_vat: c.revenue_ex_vat })),
  )
  const food = round2(split.food)
  const beverage = round2(split.beverage)
  const categoryTotal = round2(food + beverage)
  const totalRevenue = resolveDailyOpsHeadlineRevenue(ctx, {
    snapshotExVat,
    apiDayTotal,
    inboxExVat,
    categoryTotal,
  })
  return { totalRevenue, food, beverage }
}

type VenueStripSnapshotBatch = {
  revenueByLoc: Map<string, DailyOpsSnapshotRevenueSection>
  laborByLoc: Map<string, DailyOpsSnapshotLaborSection>
  productsByLoc: Map<string, DailyOpsSnapshotRevenueProductsSection>
}

async function loadVenueStripSnapshotBatch (
  db: Db,
  businessDate: string,
): Promise<VenueStripSnapshotBatch> {
  const locationIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const filter = { businessDate, locationId: { $in: locationIds } }
  const [revenueDocs, laborDocs, productDocs] = await Promise.all([
    db
      .collection<DailyOpsSnapshotRevenueSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotLaborSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueProductsSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection)
      .find(filter)
      .toArray(),
  ])
  return {
    revenueByLoc: new Map(revenueDocs.map((d) => [d.locationId, d])),
    laborByLoc: new Map(laborDocs.map((d) => [d.locationId, d])),
    productsByLoc: new Map(productDocs.map((d) => [d.locationId, d])),
  }
}

async function buildVenueStripCardFromSnapshots (
  db: Db,
  ctx: DailyOpsMetricsContext,
  venue: { locationId: string; locationName: string },
  batch: VenueStripSnapshotBatch,
): Promise<VenueStripCardDto> {
  const businessDate = ctx.startDate
  const locCtx: DailyOpsMetricsContext = { ...ctx, locationId: venue.locationId }
  const snapRev = batch.revenueByLoc.get(venue.locationId) ?? null
  const snapLabor = batch.laborByLoc.get(venue.locationId) ?? null
  const snapProducts = batch.productsByLoc.get(venue.locationId) ?? null

  const { totalRevenue, food, beverage } = revenueFromSnapshotSections(locCtx, snapRev, snapProducts)

  const [laborBundle, contractsFromSnap] = await Promise.all([
    resolveVenueStripLabor(db, businessDate, venue.locationId, snapLabor),
    Promise.resolve(contractsByTeamFromSnapshot(snapLabor)),
  ])
  let contractsByTeam = contractsFromSnap
  if (!contractsByTeamHasRows(contractsByTeam)) {
    contractsByTeam = await fetchContractsByTeam(db, businessDate, venue.locationId)
  }

  const laborWithPct = enrichLaborWithPct(laborBundle.labor, totalRevenue)

  const locationName =
    snapLabor?.locationName ?? snapRev?.locationName ?? venue.locationName

  return {
    locationId: venue.locationId,
    locationName,
    revenue: { total: totalRevenue, food, beverage },
    labor: laborWithPct,
    workers: laborBundle.workers,
    productivity: {
      totalPerHour: productivityPerHour(totalRevenue, laborWithPct.gewerkt.hours),
      keukenPerHour: productivityPerHour(food, laborWithPct.keuken.hours),
      bedieningPerHour: productivityPerHour(beverage, laborWithPct.bediening.hours),
    },
    contractsByTeam,
    coverage: {
      hasRevenue: totalRevenue > 0 || food > 0 || beverage > 0,
      hasLabor: laborWithPct.all.hours > 0,
      snapshotBuilt: !!snapLabor || !!snapRev,
    },
  }
}

/** @deprecated Use buildVenueStripResponse — kept for tests/callers that build one card. */
export async function buildVenueStripCard (
  db: Db,
  ctx: DailyOpsMetricsContext,
  venue: { locationId: string; locationName: string },
): Promise<VenueStripCardDto> {
  const batch = await loadVenueStripSnapshotBatch(db, ctx.startDate)
  return buildVenueStripCardFromSnapshots(db, ctx, venue, batch)
}

export async function buildVenueStripResponse (
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<VenueStripResponseDto> {
  const batch = await loadVenueStripSnapshotBatch(db, ctx.startDate)

  const venues = await Promise.all(
    VENUE_STRIP_LOCATIONS.map((v) => buildVenueStripCardFromSnapshots(db, ctx, v, batch)),
  )
  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    venues,
  }
}
