/**
 * @registry-id: dailyOpsVenueStripOpenShiftLabor
 * @created: 2026-06-08T00:00:00.000Z
 * @last-modified: 2026-06-09T00:00:00.000Z
 * @description: Today-only overlay — recalc hours/wages for open Eitje shifts (start → now)
 * @adr-ref: ADR-004, ADR-010
 *
 * @exports-to:
 * ✓ server/utils/venueStrip/labor.ts
 */

import type { VenueStripWorkerLineDto } from '~/types/daily-ops-dashboard'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import {
  elapsedOpenShiftHours,
  loadedCostFromCph,
  scaleLoadedCostForHours,
} from '~/utils/dailyOpsOpenShiftLabor'
import type { MemberCompensationHit } from '../eitjeAggCompensationEnrich'
import { expandWorkerLineForTeam } from '../dailyOpsVenueStripWorkers'
import type { WorkerShiftTimeMaps } from './workerShiftTimes'
import { findShiftSlot } from './workerShiftTimes'

function workerKey(userId: string, userName: string, teamName: string): string {
  return `${userId}|${userName.trim().toLowerCase()}|${teamName.trim().toLowerCase()}`
}

function isOperationalTeam(teamName: string): boolean {
  const n = teamName.trim().toLowerCase()
  return n === 'keuken' || n === 'bediening' || n === 'afwas'
}

function applyOpenHoursToLine(
  worker: VenueStripWorkerLineDto,
  startAt: Date,
  now: Date,
  costPerHour?: number,
): VenueStripWorkerLineDto {
  const nextHours = elapsedOpenShiftHours(startAt, now)
  if (nextHours <= 0) return worker
  let nextWages = scaleLoadedCostForHours(worker.hours, worker.wages, nextHours)
  if (nextWages <= 0 && costPerHour != null && costPerHour > 0) {
    nextWages = loadedCostFromCph(nextHours, costPerHour)
  }
  return {
    ...worker,
    hours: nextHours,
    wages: nextWages > 0 ? nextWages : worker.wages,
    endLabel: undefined,
  }
}

/**
 * For the open register business day: bump hours/wages on open shifts and add
 * staff who clocked in but are missing from the snapshot (hours were 0 at last build).
 */
export function applyOpenShiftLaborOverlay(
  workers: VenueStripWorkerLineDto[],
  locationId: string,
  businessDate: string,
  maps: WorkerShiftTimeMaps,
  memberComp?: Map<string, MemberCompensationHit>,
): { workers: VenueStripWorkerLineDto[]; adjusted: boolean } {
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  if (businessDate !== openRegister) {
    return { workers, adjusted: false }
  }

  const now = new Date()
  const seen = new Set<string>()
  let adjusted = false

  const updated = workers.map((worker) => {
    seen.add(workerKey(worker.userId, worker.userName, worker.teamName))
    const { eitje } = findShiftSlot(
      maps.eitje,
      maps.inbox,
      locationId,
      worker.userId,
      worker.userName,
      worker.teamName,
    )
    if (!eitje?.startAt || eitje.hasRawEnd) return worker
    adjusted = true
    return applyOpenHoursToLine(worker, eitje.startAt, now, memberComp?.get(worker.userId)?.costPerHour)
  })

  for (const row of maps.eitjeRows) {
    if (row.locationId !== locationId || row.hasRawEnd || !row.shiftStart) continue
    const key = workerKey(row.userId, row.userName, row.teamName)
    if (seen.has(key)) continue

    const hours = elapsedOpenShiftHours(row.shiftStart, now)
    if (hours <= 0) continue

    const cph = memberComp?.get(row.userId)?.costPerHour ?? 0
    const loaded = loadedCostFromCph(hours, cph)
    const operational = isOperationalTeam(row.teamName)
    const lines = expandWorkerLineForTeam(row.userId, row.userName, row.teamName, hours, loaded, operational)
    for (const line of lines) {
      updated.push({ ...line, startLabel: undefined, endLabel: undefined })
      seen.add(workerKey(line.userId, line.userName, line.teamName))
    }
    adjusted = true
  }

  return { workers: updated, adjusted }
}

export function laborTotalsFromWorkers(workers: VenueStripWorkerLineDto[]): {
  all: { hours: number; loaded: number; workers: number }
  gewerkt: { hours: number; loaded: number; workers: number }
  keuken: { hours: number; loaded: number; workers: number }
  bediening: { hours: number; loaded: number; workers: number }
  other: { hours: number; loaded: number; workers: number }
} {
  const sum = (bucket?: VenueStripWorkerLineDto['bucket'] | 'gewerkt') => {
    const rows = bucket === 'gewerkt'
      ? workers.filter((w) => w.bucket === 'keuken' || w.bucket === 'bediening')
      : bucket
        ? workers.filter((w) => w.bucket === bucket)
        : workers
    return {
      hours: Math.round(rows.reduce((s, w) => s + w.hours, 0) * 100) / 100,
      loaded: Math.round(rows.reduce((s, w) => s + w.wages, 0) * 100) / 100,
      workers: new Set(rows.map((w) => w.userId).filter(Boolean)).size,
    }
  }
  const all = sum()
  const gewerkt = sum('gewerkt')
  const keuken = sum('keuken')
  const bediening = sum('bediening')
  return {
    all,
    gewerkt,
    keuken,
    bediening,
    other: {
      hours: Math.round(Math.max(0, all.hours - gewerkt.hours) * 100) / 100,
      loaded: Math.round(Math.max(0, all.loaded - gewerkt.loaded) * 100) / 100,
      workers: new Set(workers.filter((w) => w.bucket === 'overig').map((w) => w.userId).filter(Boolean)).size,
    },
  }
}
