/**
 * @registry-id: dailyOpsStaffFetchTimeseries
 * @created: 2026-06-25T12:00:00.000Z
 * @last-modified: 2026-06-28T03:00:00.000Z
 * @description: Staff hours + headcount timeseries from snapshot labor (ADR-004)
 * @last-fix: [2026-06-28] Unique active staff per period + team group collapse
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/api/daily-ops/staff/timeseries.get.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsStaffQueryContext,
  DailyOpsStaffTimeseriesDto,
  DailyOpsStaffTimeseriesPoint,
  DailyOpsStaffTeamSeriesPoint,
} from '~/types/daily-ops-staff'
import {
  emptyStaffContractBuckets,
  type StaffContractBuckets,
} from '~/utils/dailyOpsStaffContractBuckets'
import { staffTeamGroupKey } from '~/utils/dailyOpsStaffTeamGroups'
import { fetchStaffDailyLaborRows } from './fetchStaffDailyLabor'
import { fetchRevenueDailyFromSnapshots } from '../dailyOpsRevenue/fetchRevenueDailySeries'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function unionIds(into: Set<string>, ids: string[]) {
  for (const id of ids) {
    if (id) into.add(id)
  }
}

type InternalTeam = DailyOpsStaffTeamSeriesPoint & {
  _workerIds: Set<string>
  _contractWorkerIds: Record<'ft' | 'pt' | 'zzp', Set<string>>
}

function emptyInternalTeam(teamName: string): InternalTeam {
  return {
    teamName,
    hours: 0,
    gewerkt_hours: 0,
    staff_count: 0,
    byContract: emptyStaffContractBuckets(),
    _workerIds: new Set(),
    _contractWorkerIds: { ft: new Set(), pt: new Set(), zzp: new Set() },
  }
}

function finalizeTeam(t: InternalTeam): DailyOpsStaffTeamSeriesPoint {
  const byContract = emptyStaffContractBuckets()
  for (const key of ['ft', 'pt', 'zzp'] as const) {
    byContract[key] = {
      ...(t.byContract?.[key] ?? emptyStaffContractBuckets()[key]),
      staff_count: t._contractWorkerIds[key].size,
    }
  }
  return {
    teamName: t.teamName,
    hours: t.hours,
    gewerkt_hours: t.gewerkt_hours,
    staff_count: t._workerIds.size,
    byContract,
  }
}

type InternalPoint = Omit<DailyOpsStaffTimeseriesPoint, 'teams'> & {
  _workerIds: Set<string>
  _contractWorkerIds: Record<'ft' | 'pt' | 'zzp', Set<string>>
  teams: InternalTeam[]
}

function emptyInternalPoint(date: string): InternalPoint {
  return {
    ...emptyTimeseriesPoint(date),
    _workerIds: new Set(),
    _contractWorkerIds: {
      ft: new Set(),
      pt: new Set(),
      zzp: new Set(),
    },
    teams: [],
  }
}

function collapseTeamsByGroup(teams: InternalTeam[]): InternalTeam[] {
  const map = new Map<string, InternalTeam>()
  for (const t of teams) {
    const groupKey = staffTeamGroupKey(t.teamName)
    const ex = map.get(groupKey) ?? emptyInternalTeam(groupKey)
    ex.hours = round2(ex.hours + t.hours)
    ex.gewerkt_hours = round2(ex.gewerkt_hours + t.gewerkt_hours)
    unionIds(ex._workerIds, [...t._workerIds])
    ex.byContract = mergeContractBuckets(ex.byContract ?? emptyStaffContractBuckets(), t.byContract ?? emptyStaffContractBuckets())
    for (const key of ['ft', 'pt', 'zzp'] as const) {
      unionIds(ex._contractWorkerIds[key], [...t._contractWorkerIds[key]])
    }
    map.set(groupKey, ex)
  }
  return [...map.values()].sort((a, b) => a.teamName.localeCompare(b.teamName))
}

function mergeInternalPoints(into: InternalPoint, from: InternalPoint) {
  into.hours = round2(into.hours + from.hours)
  into.gewerkt_hours = round2(into.gewerkt_hours + from.gewerkt_hours)
  into.revenue_ex_vat = round2((into.revenue_ex_vat ?? 0) + (from.revenue_ex_vat ?? 0))
  into.labor_loaded_cost = round2((into.labor_loaded_cost ?? 0) + (from.labor_loaded_cost ?? 0))
  unionIds(into._workerIds, [...from._workerIds])
  if (from.byContract) {
    into.byContract = mergeContractBuckets(
      into.byContract ?? emptyStaffContractBuckets(),
      from.byContract,
    )
  }
  for (const key of ['ft', 'pt', 'zzp'] as const) {
    unionIds(into._contractWorkerIds[key], [...from._contractWorkerIds[key]])
  }

  const teamMap = new Map(into.teams.map((t) => [t.teamName, t]))
  for (const t of from.teams) {
    const ex = teamMap.get(t.teamName) ?? {
      teamName: t.teamName,
      hours: 0,
      gewerkt_hours: 0,
      staff_count: 0,
      _workerIds: new Set<string>(),
      _contractWorkerIds: { ft: new Set(), pt: new Set(), zzp: new Set() },
      byContract: emptyStaffContractBuckets(),
    }
    ex.hours = round2(ex.hours + t.hours)
    ex.gewerkt_hours = round2(ex.gewerkt_hours + t.gewerkt_hours)
    unionIds(ex._workerIds, [...t._workerIds])
    ex.byContract = mergeContractBuckets(ex.byContract ?? emptyStaffContractBuckets(), t.byContract ?? emptyStaffContractBuckets())
    for (const key of ['ft', 'pt', 'zzp'] as const) {
      unionIds(ex._contractWorkerIds[key], [...t._contractWorkerIds[key]])
    }
    teamMap.set(t.teamName, ex)
  }
  into.teams = [...teamMap.values()].sort((a, b) => a.teamName.localeCompare(b.teamName))
}

function finalizePoint(p: InternalPoint): DailyOpsStaffTimeseriesPoint {
  const collapsedTeams = collapseTeamsByGroup(p.teams)
  const byContract = emptyStaffContractBuckets()
  for (const key of ['ft', 'pt', 'zzp'] as const) {
    byContract[key] = {
      ...(p.byContract?.[key] ?? emptyStaffContractBuckets()[key]),
      staff_count: p._contractWorkerIds[key].size,
    }
  }
  return {
    date: p.date,
    hours: p.hours,
    gewerkt_hours: p.gewerkt_hours,
    staff_count: p._workerIds.size,
    revenue_ex_vat: p.revenue_ex_vat,
    labor_loaded_cost: p.labor_loaded_cost,
    byContract,
    teams: collapsedTeams.map(finalizeTeam),
  }
}

function mergeContractBuckets(a: StaffContractBuckets, b: StaffContractBuckets): StaffContractBuckets {
  const out = emptyStaffContractBuckets()
  for (const key of ['ft', 'pt', 'zzp'] as const) {
    out[key].hours = round2(a[key].hours + b[key].hours)
    out[key].gewerkt_hours = round2(a[key].gewerkt_hours + b[key].gewerkt_hours)
    out[key].staff_count = a[key].staff_count + b[key].staff_count
    out[key].loaded_cost = round2(a[key].loaded_cost + b[key].loaded_cost)
  }
  return out
}

function emptyTimeseriesPoint(date: string): DailyOpsStaffTimeseriesPoint {
  return {
    date,
    hours: 0,
    gewerkt_hours: 0,
    staff_count: 0,
    revenue_ex_vat: 0,
    labor_loaded_cost: 0,
    byContract: emptyStaffContractBuckets(),
    teams: [],
  }
}

function bucketKey(date: string, granularity: 'week' | 'month' | 'year'): string {
  const d = new Date(`${date}T12:00:00Z`)
  if (granularity === 'year') return String(d.getUTCFullYear())
  if (granularity === 'month') {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function enumerateDays(start: string, end: string): string[] {
  const out: string[] = []
  const [ys, ms, ds] = start.split('-').map(Number)
  const [ye, me, de] = end.split('-').map(Number)
  let cur = Date.UTC(ys!, ms! - 1, ds!)
  const endT = Date.UTC(ye!, me! - 1, de!)
  while (cur <= endT) {
    const dt = new Date(cur)
    const p = (n: number) => String(n).padStart(2, '0')
    out.push(`${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`)
    cur += 86400000
  }
  return out
}

function aggregateDailyRows(
  rows: Awaited<ReturnType<typeof fetchStaffDailyLaborRows>>,
): InternalPoint[] {
  const byDate = new Map<string, InternalPoint>()

  for (const row of rows) {
    const cur = byDate.get(row.date) ?? emptyInternalPoint(row.date)
    cur.hours = round2(cur.hours + row.hours)
    cur.gewerkt_hours = round2(cur.gewerkt_hours + row.gewerkt_hours)
    cur.labor_loaded_cost = round2(cur.labor_loaded_cost + row.labor_loaded_cost)
    unionIds(cur._workerIds, row.workerIds)
    cur.byContract = mergeContractBuckets(cur.byContract ?? emptyStaffContractBuckets(), row.byContract)
    for (const key of ['ft', 'pt', 'zzp'] as const) {
      unionIds(cur._contractWorkerIds[key], row.contractWorkerIds[key])
    }

    const teamMap = new Map(cur.teams.map((t) => [t.teamName, t]))
    for (const t of row.teams) {
      const ex = teamMap.get(t.teamName) ?? emptyInternalTeam(t.teamName)
      ex.hours = round2(ex.hours + t.hours)
      ex.gewerkt_hours = round2(ex.gewerkt_hours + t.gewerkt_hours)
      unionIds(ex._workerIds, t.workerIds)
      ex.byContract = mergeContractBuckets(ex.byContract ?? emptyStaffContractBuckets(), t.byContract)
      for (const key of ['ft', 'pt', 'zzp'] as const) {
        unionIds(ex._contractWorkerIds[key], t.contractWorkerIds[key])
      }
      teamMap.set(t.teamName, ex)
    }
    cur.teams = [...teamMap.values()].sort((a, b) => a.teamName.localeCompare(b.teamName))
    byDate.set(row.date, cur)
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function enrichDailyInternal(
  daily: InternalPoint[],
  revForDate: (date: string) => number,
): InternalPoint[] {
  return daily.map((p) => ({
    ...p,
    revenue_ex_vat: revForDate(p.date),
  }))
}

function aggregatePointsInternal(
  daily: InternalPoint[],
  granularity: 'day' | 'week' | 'month' | 'year',
): InternalPoint[] {
  if (granularity === 'day') return daily
  const map = new Map<string, InternalPoint>()
  for (const p of daily) {
    const key = bucketKey(p.date, granularity)
    const cur = map.get(key) ?? emptyInternalPoint(key)
    mergeInternalPoints(cur, p)
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function fillBucketGapsInternal(
  points: InternalPoint[],
  start: string,
  end: string,
  granularity: 'week' | 'month' | 'year',
): InternalPoint[] {
  const map = new Map(points.map((p) => [p.date, p]))
  return enumerateBucketKeys(start, end, granularity).map(
    (key) => map.get(key) ?? emptyInternalPoint(key),
  )
}

function enumerateBucketKeys(
  start: string,
  end: string,
  granularity: 'week' | 'month' | 'year',
): string[] {
  if (granularity === 'year') {
    const sy = Number(start.slice(0, 4))
    const ey = Number(end.slice(0, 4))
    return Array.from({ length: ey - sy + 1 }, (_, i) => String(sy + i))
  }
  if (granularity === 'month') {
    const out: string[] = []
    const d = new Date(`${start.slice(0, 7)}-01T12:00:00Z`)
    const endKey = end.slice(0, 7)
    while (true) {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      out.push(key)
      if (key >= endKey) break
      d.setUTCMonth(d.getUTCMonth() + 1)
    }
    return out
  }
  const out: string[] = []
  const endWeek = new Date(`${end}T12:00:00Z`)
  const endDay = endWeek.getUTCDay()
  const endMondayOffset = endDay === 0 ? -6 : 1 - endDay
  endWeek.setUTCDate(endWeek.getUTCDate() + endMondayOffset)
  for (let i = 51; i >= 0; i--) {
    const d = new Date(endWeek)
    d.setUTCDate(d.getUTCDate() - i * 7)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function fillBucketGaps(
  points: DailyOpsStaffTimeseriesPoint[],
  start: string,
  end: string,
  granularity: 'week' | 'month' | 'year',
): DailyOpsStaffTimeseriesPoint[] {
  const map = new Map(points.map((p) => [p.date, p]))
  return enumerateBucketKeys(start, end, granularity).map(
    (key) => map.get(key) ?? emptyTimeseriesPoint(key),
  )
}

function aggregatePoints(
  daily: InternalPoint[],
  granularity: 'day' | 'week' | 'month' | 'year',
): DailyOpsStaffTimeseriesPoint[] {
  return aggregatePointsInternal(daily, granularity).map(finalizePoint)
}

function aggregatePointsFromDaily(
  daily: InternalPoint[],
  granularity: 'day' | 'week' | 'month' | 'year',
): DailyOpsStaffTimeseriesPoint[] {
  if (granularity === 'day') return daily.map(finalizePoint)
  const aggregated = aggregatePointsInternal(daily, granularity)
  return aggregated.map(finalizePoint)
}

async function loadRevenueByLocation(
  db: Db,
  start: string,
  end: string,
  locationIds: string[],
): Promise<Map<string, Map<string, number>>> {
  const entries = await Promise.all(
    locationIds.map(async (locationId) => {
      const byDate = await fetchRevenueDailyFromSnapshots(db, start, end, locationId)
      const rev = new Map<string, number>()
      for (const [date, point] of byDate.entries()) {
        rev.set(date, point.revenue)
      }
      return [locationId, rev] as const
    }),
  )
  return new Map(entries)
}

function enrichDailyWithRevenue(
  daily: DailyOpsStaffTimeseriesPoint[],
  revForDate: (date: string) => number,
): DailyOpsStaffTimeseriesPoint[] {
  return daily.map((p) => ({
    ...p,
    revenue_ex_vat: revForDate(p.date),
  }))
}

export async function fetchStaffTimeseries(
  db: Db,
  ctx: DailyOpsStaffQueryContext,
  granularity: 'day' | 'week' | 'month' | 'year' = 'day',
): Promise<DailyOpsStaffTimeseriesDto> {
  const rows = await fetchStaffDailyLaborRows(db, ctx.startDate, ctx.endDate, ctx.locationId)
  const locationIds = [...new Set(rows.map((r) => r.locationId))]
  const revenueByLocation = locationIds.length
    ? await loadRevenueByLocation(db, ctx.startDate, ctx.endDate, locationIds)
    : new Map<string, Map<string, number>>()

  const sumRevenueAllVenues = (date: string): number => {
    let sum = 0
    for (const locId of locationIds) {
      sum += revenueByLocation.get(locId)?.get(date) ?? 0
    }
    return round2(sum)
  }

  const dailyInternal = enrichDailyInternal(aggregateDailyRows(rows), sumRevenueAllVenues)
  const aggregatedInternal =
    granularity === 'day'
      ? dailyInternal
      : aggregatePointsInternal(dailyInternal, granularity)
  const current =
    granularity === 'day'
      ? aggregatedInternal.map(finalizePoint)
      : fillBucketGapsInternal(aggregatedInternal, ctx.startDate, ctx.endDate, granularity).map(
          finalizePoint,
        )

  const byLocationMap = new Map<string, { locationId: string; locationName: string; rows: typeof rows }>()
  for (const row of rows) {
    const ex = byLocationMap.get(row.locationId) ?? {
      locationId: row.locationId,
      locationName: row.locationName,
      rows: [],
    }
    ex.rows.push(row)
    byLocationMap.set(row.locationId, ex)
  }

  const byLocation = !ctx.locationId
    ? [...byLocationMap.values()].map((loc) => {
        const locDailyInternal = enrichDailyInternal(
          aggregateDailyRows(loc.rows),
          (date) => revenueByLocation.get(loc.locationId)?.get(date) ?? 0,
        )
        const locAggregatedInternal =
          granularity === 'day'
            ? locDailyInternal
            : aggregatePointsInternal(locDailyInternal, granularity)
        const locPoints =
          granularity === 'day'
            ? locAggregatedInternal.map(finalizePoint)
            : fillBucketGapsInternal(
                locAggregatedInternal,
                ctx.startDate,
                ctx.endDate,
                granularity,
              ).map(finalizePoint)
        const locDailyFinal = locDailyInternal.map(finalizePoint)
        return {
          locationId: loc.locationId,
          locationName: loc.locationName,
          points: locPoints,
          totals: {
            hours: round2(loc.rows.reduce((s, r) => s + r.gewerkt_hours, 0)),
            staff_count: locDailyFinal.length
              ? Math.max(...locDailyFinal.map((p) => p.staff_count))
              : 0,
          },
        }
      })
    : undefined

  const expectedDays = enumerateDays(ctx.startDate, ctx.endDate).length
  const daysFound = new Set(rows.map((r) => r.date)).size

  return {
    granularity,
    label: ctx.label,
    current,
    byLocation,
    totals: {
      hours: round2(current.reduce((s, p) => s + p.gewerkt_hours, 0)),
      staff_count: current.length
        ? Math.max(...current.map((p) => p.staff_count))
        : 0,
    },
    coverage: {
      daysFound,
      daysExpected: expectedDays,
    },
  }
}
