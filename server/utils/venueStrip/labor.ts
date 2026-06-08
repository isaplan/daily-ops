/**
 * @registry-id: dailyOpsVenueStripLabor
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-06-07T00:00:00.000Z
 * @description: Venue-strip labor bucket resolution from snapshot labor sections
 * @last-fix: [2026-06-08] Open-shift hours overlay on today (start → now) + labor totals refresh
 * @adr-ref: ADR-004
 */

import type { Db } from 'mongodb'
import type { VenueStripCardDto, VenueStripLaborRowDto, VenueStripTeamBucket, VenueStripWorkerLineDto } from '~/types/daily-ops-dashboard'
import type { DailyOpsSnapshotLaborSection } from '~/types/daily-ops-snapshot'
import {
  enrichSnapshotLaborWorkersFromMembers,
  loadMemberCompensationByShiftUserIds,
} from '../eitjeAggCompensationEnrich'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { allocateOperationalTeamLabor, type VenueLaborSlice } from '../eitjeVenueLaborRollup'
import { bucketTeamFromName } from '../dailyOpsTeamBucket'
import { workersFromSnapshot } from '../dailyOpsVenueStripWorkers'
import { enrichWorkersWithShiftTimesFromMaps, type WorkerShiftTimeMaps } from './workerShiftTimes'
import { applyOpenShiftLaborOverlay, laborTotalsFromWorkers } from './openShiftLaborOverlay'

export type VenueStripLaborBundle = {
  labor: VenueStripCardDto['labor']
  workers: VenueStripWorkerLineDto[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function emptyLaborRow(): VenueStripLaborRowDto {
  return { workers: 0, hours: 0, wages: 0, loaded: 0, laborPctOfRevenue: null }
}

export function emptyLaborBlock(): VenueStripCardDto['labor'] {
  const row = emptyLaborRow()
  return {
    all: { ...row },
    gewerkt: { ...row },
    keuken: { ...row },
    bediening: { ...row },
    other: { ...row },
  }
}

export function withLaborPct(row: VenueStripLaborRowDto, revenue: number): VenueStripLaborRowDto {
  return {
    ...row,
    laborPctOfRevenue: revenue > 0 ? round2((row.loaded / revenue) * 100) : null,
  }
}

export function enrichLaborWithPct(
  labor: VenueStripCardDto['labor'],
  revenue: number,
): VenueStripCardDto['labor'] {
  return {
    all: withLaborPct(labor.all, revenue),
    gewerkt: withLaborPct(labor.gewerkt, revenue),
    keuken: withLaborPct(labor.keuken, revenue),
    bediening: withLaborPct(labor.bediening, revenue),
    other: withLaborPct(labor.other, revenue),
  }
}

function finalizeLaborOther(labor: VenueStripCardDto['labor'], workers: VenueStripWorkerLineDto[]): void {
  const overigIds = new Set(workers.filter((w) => w.bucket === 'overig' && w.userId).map((w) => w.userId))
  labor.other = {
    hours: round2(Math.max(0, labor.all.hours - labor.gewerkt.hours)),
    wages: round2(Math.max(0, labor.all.wages - labor.gewerkt.wages)),
    loaded: round2(Math.max(0, labor.all.loaded - labor.gewerkt.loaded)),
    workers: overigIds.size,
    laborPctOfRevenue: null,
  }
}

function addVenueLaborSlice(target: VenueStripLaborRowDto, source: VenueLaborSlice): void {
  target.hours += source.hours
  target.wages += source.wages
  target.loaded += source.loaded
}

function finalizeVenueLaborRow(row: VenueStripLaborRowDto): void {
  row.hours = round2(row.hours)
  row.wages = round2(row.wages)
  row.loaded = round2(row.loaded)
  row.laborPctOfRevenue = null
}

function laborRowFromCostPair(
  pair: { hours: number; wage_cost: number; loaded_cost: number },
  workers = 0,
): VenueStripLaborRowDto {
  return {
    workers,
    hours: round2(Number(pair.hours ?? 0)),
    wages: round2(Number(pair.wage_cost ?? 0)),
    loaded: round2(Number(pair.loaded_cost ?? 0)),
    laborPctOfRevenue: null,
  }
}

function laborRowFromWorkerLines(
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

function operationalLooksStale(doc: DailyOpsSnapshotLaborSection, workers: VenueStripWorkerLineDto[]): boolean {
  const workerKeuken = workers.filter((w) => w.bucket === 'keuken').reduce((sum, w) => sum + Number(w.hours ?? 0), 0)
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

export async function resolveVenueStripLabor(
  db: Db,
  snapLabor: DailyOpsSnapshotLaborSection | null,
  businessDate: string,
  locationId: string,
  shiftTimeMaps?: WorkerShiftTimeMaps,
): Promise<VenueStripLaborBundle> {
  await enrichSnapshotLaborWorkersFromMembers(db, snapLabor?.workers as Array<Record<string, unknown>> | undefined)
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const memberComp =
    businessDate === openRegister && shiftTimeMaps
      ? await loadMemberCompensationByShiftUserIds(
          db,
          shiftTimeMaps.eitjeRows
            .filter((r) => r.locationId === locationId && !r.hasRawEnd)
            .map((r) => r.userId),
        )
      : undefined
  const workerBuckets: Record<VenueStripTeamBucket, Set<string>> = {
    keuken: new Set(),
    bediening: new Set(),
    other: new Set(),
  }
  const labor = emptyLaborBlock()
  const workers = workersFromSnapshot(snapLabor)

  const enrich = (lines: VenueStripWorkerLineDto[]) => {
    let out = shiftTimeMaps
      ? enrichWorkersWithShiftTimesFromMaps(lines, locationId, businessDate, shiftTimeMaps)
      : lines
    if (shiftTimeMaps) {
      const { workers: overlaid, adjusted } = applyOpenShiftLaborOverlay(
        out,
        locationId,
        businessDate,
        shiftTimeMaps,
        memberComp,
      )
      out = enrichWorkersWithShiftTimesFromMaps(overlaid, locationId, businessDate, shiftTimeMaps)
      if (adjusted) {
        const totals = laborTotalsFromWorkers(out)
        labor.all = {
          ...labor.all,
          hours: totals.all.hours,
          wages: totals.all.loaded,
          loaded: totals.all.loaded,
          workers: totals.all.workers,
        }
        labor.gewerkt = {
          ...labor.gewerkt,
          hours: totals.gewerkt.hours,
          wages: totals.gewerkt.loaded,
          loaded: totals.gewerkt.loaded,
          workers: totals.gewerkt.workers,
        }
        labor.keuken = {
          ...labor.keuken,
          hours: totals.keuken.hours,
          wages: totals.keuken.loaded,
          loaded: totals.keuken.loaded,
          workers: totals.keuken.workers,
        }
        labor.bediening = {
          ...labor.bediening,
          hours: totals.bediening.hours,
          wages: totals.bediening.loaded,
          loaded: totals.bediening.loaded,
          workers: totals.bediening.workers,
        }
        labor.other = {
          ...labor.other,
          hours: totals.other.hours,
          wages: totals.other.loaded,
          loaded: totals.other.loaded,
          workers: totals.other.workers,
        }
      }
    }
    return out
  }

  const doc = snapLabor
  if (!doc) {
    finalizeLaborOther(labor, workers)
    return { labor, workers: enrich(workers) }
  }

  for (const w of doc.workers ?? []) {
    const bucket = bucketTeamFromName(String(w.teamName ?? ''))
    const uid = String(w.userId ?? '')
    if (uid) workerBuckets[bucket].add(uid)
  }

  if (doc.operational) {
    labor.all = laborRowFromCostPair(
      doc.totals,
      new Set([...workerBuckets.keuken, ...workerBuckets.bediening, ...workerBuckets.other]).size,
    )
    if (operationalLooksStale(doc, workers)) {
      labor.keuken = laborRowFromWorkerLines(workers, 'keuken')
      labor.bediening = laborRowFromWorkerLines(workers, 'bediening')
      labor.gewerkt = {
        workers: new Set(
          workers
            .filter((w) => w.bucket === 'keuken' || w.bucket === 'bediening')
            .map((w) => w.userId)
            .filter(Boolean),
        ).size,
        hours: round2(labor.keuken.hours + labor.bediening.hours),
        wages: round2(labor.keuken.wages + labor.bediening.wages),
        loaded: round2(labor.keuken.loaded + labor.bediening.loaded),
        laborPctOfRevenue: null,
      }
      finalizeLaborOther(labor, workers)
      return { labor, workers: enrich(workers) }
    }
    labor.gewerkt = laborRowFromCostPair(
      doc.operational.gewerkt,
      new Set([...workerBuckets.keuken, ...workerBuckets.bediening]).size,
    )
    labor.keuken = laborRowFromCostPair(doc.operational.keuken, workerBuckets.keuken.size)
    labor.bediening = laborRowFromCostPair(doc.operational.bediening, workerBuckets.bediening.size)
    finalizeLaborOther(labor, workers)
    return { labor, workers: enrich(workers) }
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
    workers: new Set([...workerBuckets.keuken, ...workerBuckets.bediening, ...workerBuckets.other]).size,
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

  return {
    labor,
    workers: enrich(workers),
  }
}

export function productivityPerHour(revenue: number, hours: number): number | null {
  if (hours <= 0 || revenue <= 0) return null
  return round2(revenue / hours)
}
