/**
 * @registry-id: dailyOpsVenueStrip
 * @created: 2026-05-16T23:30:00.000Z
 * @last-modified: 2026-05-19T00:00:00.000Z
 * @description: Builds per-venue KPI cards for the Daily Ops venue strip (3 fixed locations, single day).
 * @last-fix: [2026-05-21] Labor KPIs use loaded cost; % rev from loaded
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/venue-strip.get.ts
 */

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import type {
  VenueStripCardDto,
  VenueStripContractRowDto,
  VenueStripLaborRowDto,
  VenueStripResponseDto,
  VenueStripTeamBucket,
  VenueStripWorkerLineDto,
} from '../../types/daily-ops-dashboard'
import type { DailyOpsMetricsContext } from './dailyOpsDashboardMetrics'
import {
  fetchInboxBasisRevenueTotalExVat,
  fetchRevenueByCategoryFromHourAggregates,
  fetchRevenueByDate,
} from './dailyOpsDashboardMetrics'
import { bucketTeamFromName } from './dailyOpsTeamBucket'
import {
  aggRowsUseLegacyGewerktSchema,
  allocateOperationalTeamLabor,
  resolveRowGewerktSlice,
  type VenueLaborSlice,
} from './eitjeVenueLaborRollup'
import type { DailyOpsSnapshotLaborSection } from '../../types/daily-ops-snapshot'
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

function resolveVenueHeadlineRevenue (
  ctx: DailyOpsMetricsContext,
  apiDayTotal: number,
  inboxExVat: number | null
): number {
  const singleCompletedDay = ctx.startDate === ctx.endDate && ctx.period !== 'today'
  const useInbox = singleCompletedDay && inboxExVat != null && inboxExVat > 0
  return round2(useInbox ? inboxExVat : apiDayTotal)
}

function productivityPerHour (revenue: number, hours: number): number | null {
  if (hours <= 0 || revenue <= 0) return null
  return round2(revenue / hours)
}

function eitjeLocationMatch (locationId: string): Record<string, unknown> {
  try {
    const oid = new ObjectId(locationId)
    return { $in: [oid, locationId] }
  } catch {
    return locationId
  }
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

function snapshotHasOperationalLabor (doc: DailyOpsSnapshotLaborSection | null): boolean {
  if (!doc) return false
  const g =
    doc.operational?.gewerkt?.hours ??
    doc.totals_gewerkt?.hours ??
    0
  return g > 0
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

async function resolveVenueStripLabor (
  db: Db,
  businessDate: string,
  locationId: string,
  snapLabor: DailyOpsSnapshotLaborSection | null
): Promise<VenueStripLaborBundle> {
  if (snapshotHasOperationalLabor(snapLabor)) {
    return laborFromSnapshot(db, snapLabor)
  }
  const fromAgg = await laborFromEitjeAgg(db, businessDate, locationId)
  if (fromAgg.labor.gewerkt.hours > 0) return fromAgg
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
  locationId: string
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
  const workerBuckets: Record<VenueStripTeamBucket, Set<string>> = {
    keuken: new Set(),
    bediening: new Set(),
    other: new Set(),
  }

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
      const slice: VenueLaborSlice = gewSlice
      const alloc = allocateOperationalTeamLabor(String(r.team_name ?? ''), slice)
      addVenueLaborSlice(labor.keuken, alloc.keuken)
      addVenueLaborSlice(labor.bediening, alloc.bediening)
      const uid = String(r.userId ?? '')
      if (uid) {
        if (alloc.keuken.hours > 0) gewerktWorkers.keuken.add(uid)
        if (alloc.bediening.hours > 0) gewerktWorkers.bediening.add(uid)
      }
    }

    const uid = String(r.userId ?? '')
    if (uid) {
      allWorkers.add(uid)
      workerBuckets[bucketTeamFromName(String(r.team_name ?? ''))].add(uid)
    }
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
  locationId: string
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

export async function buildVenueStripCard (
  db: Db,
  ctx: DailyOpsMetricsContext,
  venue: { locationId: string; locationName: string }
): Promise<VenueStripCardDto> {
  const businessDate = ctx.startDate
  const locCtx: DailyOpsMetricsContext = { ...ctx, locationId: venue.locationId }

  const [revMap, inboxExVat, cat, snapLabor] = await Promise.all([
    fetchRevenueByDate(db, locCtx),
    fetchInboxBasisRevenueTotalExVat(db, locCtx),
    fetchRevenueByCategoryFromHourAggregates(db, locCtx),
    db.collection('daily_ops_snapshot_section_labor').findOne({
      businessDate,
      locationId: venue.locationId,
    }) as Promise<DailyOpsSnapshotLaborSection | null>,
  ])

  const apiDayTotal = revMap.get(businessDate) ?? 0
  const food = round2(cat.food)
  const beverage = round2(cat.drinks)
  const categoryTotal = round2(food + beverage)
  let totalRevenue = resolveVenueHeadlineRevenue(locCtx, apiDayTotal, inboxExVat)
  if (totalRevenue <= 0 && categoryTotal > 0) {
    totalRevenue = categoryTotal
  }

  const snapshotBuilt = !!snapLabor

  const [contractsByTeam, laborBundle] = await Promise.all([
    fetchContractsByTeam(db, businessDate, venue.locationId),
    resolveVenueStripLabor(db, businessDate, venue.locationId, snapLabor),
  ])

  const laborWithPct = enrichLaborWithPct(laborBundle.labor, totalRevenue)

  const productivity = {
    totalPerHour: productivityPerHour(totalRevenue, laborWithPct.gewerkt.hours),
    keukenPerHour: productivityPerHour(food, laborWithPct.keuken.hours),
    bedieningPerHour: productivityPerHour(beverage, laborWithPct.bediening.hours),
  }

  const mapping = await db.collection('bork_unified_location_mapping').findOne({
    unifiedLocationId: ObjectId.isValid(venue.locationId) ? new ObjectId(venue.locationId) : venue.locationId,
  })
  const locationName = String(mapping?.unifiedLocationName ?? snapLabor?.location_name ?? venue.locationName)

  return {
    locationId: venue.locationId,
    locationName,
    revenue: { total: totalRevenue, food, beverage },
    labor: laborWithPct,
    workers: laborBundle.workers,
    productivity,
    contractsByTeam,
    coverage: {
      hasRevenue: totalRevenue > 0 || food > 0 || beverage > 0,
      hasLabor: laborWithPct.all.hours > 0,
      snapshotBuilt,
    },
  }
}

export async function buildVenueStripResponse (
  db: Db,
  ctx: DailyOpsMetricsContext
): Promise<VenueStripResponseDto> {
  const venues = await Promise.all(
    VENUE_STRIP_LOCATIONS.map((v) => buildVenueStripCard(db, ctx, v))
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
