/**
 * @registry-id: dailyOpsPeriodCacheResolveAttendance
 * @created: 2026-08-09T01:00:00.000Z
 * @last-modified: 2026-08-09T01:00:00.000Z
 * @description: Attendance KPIs from period-cache staff.workers (no live Eitje on GET)
 * @last-fix: [2026-08-09] PERIOD_CACHE_ADR L2 — sick/leave/planned from day-node workers
 * @adr-ref: PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/attendance-kpis.get.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsAttendanceKpiBlockDto,
  DailyOpsAttendanceKpisDto,
  DailyOpsAttendanceStaffRowDto,
  DailyOpsAttendanceVenueDto,
} from '~/types/daily-ops-dashboard'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import { loadPeriodDayNodesForRange } from './loadPeriodDayNodesForRange'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function emptyVenue (locationId: string, locationName: string): DailyOpsAttendanceVenueDto {
  return { locationId, locationName, workers: 0, hours: 0, loaded: 0, rows: [] }
}

function emptyBlock (): DailyOpsAttendanceKpiBlockDto {
  return {
    workers: 0,
    hours: 0,
    loaded: 0,
    venues: VENUE_STRIP_LOCATIONS.map((v) => emptyVenue(v.locationId, v.locationName)),
  }
}

function finalizeBlock (
  byVenue: Map<string, { workers: Set<string>; hours: number; loaded: number; rows: DailyOpsAttendanceStaffRowDto[] }>,
): DailyOpsAttendanceKpiBlockDto {
  const venues: DailyOpsAttendanceVenueDto[] = VENUE_STRIP_LOCATIONS.map((v) => {
    const hit = byVenue.get(v.locationId)
    if (!hit) return emptyVenue(v.locationId, v.locationName)
    return {
      locationId: v.locationId,
      locationName: v.locationName,
      workers: hit.workers.size,
      hours: round2(hit.hours),
      loaded: round2(hit.loaded),
      rows: hit.rows,
    }
  })
  const workers = new Set<string>()
  let hours = 0
  let loaded = 0
  for (const v of venues) {
    for (const r of v.rows) workers.add(r.userId)
    hours += v.hours
    loaded += v.loaded
  }
  return { workers: workers.size, hours: round2(hours), loaded: round2(loaded), venues }
}

function ensureVenue (
  map: Map<string, { workers: Set<string>; hours: number; loaded: number; rows: DailyOpsAttendanceStaffRowDto[] }>,
  locationId: string,
) {
  let hit = map.get(locationId)
  if (!hit) {
    hit = { workers: new Set(), hours: 0, loaded: 0, rows: [] }
    map.set(locationId, hit)
  }
  return hit
}

/** Build attendance KPIs from period-cache day nodes (staff.workers sick/leave flags). */
export async function resolveAttendanceFromPeriodCache (
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsAttendanceKpisDto> {
  const locationIds = ctx.locationId && ctx.locationId !== 'all'
    ? [ctx.locationId]
    : VENUE_STRIP_LOCATIONS.map((v) => v.locationId)

  const planned = new Map<string, { workers: Set<string>; hours: number; loaded: number; rows: DailyOpsAttendanceStaffRowDto[] }>()
  const leave = new Map<string, { workers: Set<string>; hours: number; loaded: number; rows: DailyOpsAttendanceStaffRowDto[] }>()
  const sick = new Map<string, { workers: Set<string>; hours: number; loaded: number; rows: DailyOpsAttendanceStaffRowDto[] }>()

  for (const locationId of locationIds) {
    const nodes = await loadPeriodDayNodesForRange(db, {
      startDate: ctx.startDate,
      endDate: ctx.endDate,
      locationId,
    })
    for (const n of nodes) {
      for (const w of n.staff.workers ?? []) {
        if (!w.memberId || w.hours <= 0) continue
        const row: DailyOpsAttendanceStaffRowDto = {
          userId: w.memberId,
          userName: w.memberId,
          teamName: w.team || '—',
          hours: round2(w.hours),
          loaded: round2(w.wage),
        }
        const target = w.sick ? sick : w.leave ? leave : planned
        const venue = ensureVenue(target, locationId)
        venue.workers.add(w.memberId)
        venue.hours += w.hours
        venue.loaded += w.wage
        venue.rows.push(row)
      }
    }
  }

  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    planned: locationIds.length ? finalizeBlock(planned) : emptyBlock(),
    leave: locationIds.length ? finalizeBlock(leave) : emptyBlock(),
    sick: locationIds.length ? finalizeBlock(sick) : emptyBlock(),
  }
}
