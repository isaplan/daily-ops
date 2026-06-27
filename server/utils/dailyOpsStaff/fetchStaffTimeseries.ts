/**
 * @registry-id: dailyOpsStaffFetchTimeseries
 * @created: 2026-06-25T12:00:00.000Z
 * @last-modified: 2026-06-25T12:00:00.000Z
 * @description: Staff hours + headcount timeseries from snapshot labor (ADR-004)
 * @last-fix: [2026-06-25] Bucketed staff analytics series
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
import { fetchStaffDailyLaborRows } from './fetchStaffDailyLabor'

function round2(n: number): number {
  return Math.round(n * 100) / 100
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
): DailyOpsStaffTimeseriesPoint[] {
  const byDate = new Map<string, DailyOpsStaffTimeseriesPoint>()

  for (const row of rows) {
    const cur = byDate.get(row.date) ?? {
      date: row.date,
      hours: 0,
      gewerkt_hours: 0,
      staff_count: 0,
      teams: [] as DailyOpsStaffTeamSeriesPoint[],
    }
    cur.hours = round2(cur.hours + row.hours)
    cur.gewerkt_hours = round2(cur.gewerkt_hours + row.gewerkt_hours)
    cur.staff_count += row.staff_count

    const teamMap = new Map(cur.teams.map((t) => [t.teamName, { ...t }]))
    for (const t of row.teams) {
      const ex = teamMap.get(t.teamName) ?? {
        teamName: t.teamName,
        hours: 0,
        gewerkt_hours: 0,
        staff_count: 0,
      }
      ex.hours = round2(ex.hours + t.hours)
      ex.gewerkt_hours = round2(ex.gewerkt_hours + t.gewerkt_hours)
      ex.staff_count += t.staff_count
      teamMap.set(t.teamName, ex)
    }
    cur.teams = [...teamMap.values()].sort((a, b) => a.teamName.localeCompare(b.teamName))
    byDate.set(row.date, cur)
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
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
    (key) =>
      map.get(key) ?? {
        date: key,
        hours: 0,
        gewerkt_hours: 0,
        staff_count: 0,
        teams: [],
      },
  )
}

function aggregatePoints(
  daily: DailyOpsStaffTimeseriesPoint[],
  granularity: 'day' | 'week' | 'month' | 'year',
): DailyOpsStaffTimeseriesPoint[] {
  if (granularity === 'day') return daily
  const map = new Map<string, DailyOpsStaffTimeseriesPoint>()
  for (const p of daily) {
    const key = bucketKey(p.date, granularity as 'week' | 'month' | 'year')
    const cur = map.get(key) ?? {
      date: key,
      hours: 0,
      gewerkt_hours: 0,
      staff_count: 0,
      teams: [] as DailyOpsStaffTeamSeriesPoint[],
    }
    cur.hours = round2(cur.hours + p.hours)
    cur.gewerkt_hours = round2(cur.gewerkt_hours + p.gewerkt_hours)
    cur.staff_count = Math.max(cur.staff_count, p.staff_count)

    const teamMap = new Map(cur.teams.map((t) => [t.teamName, { ...t }]))
    for (const t of p.teams ?? []) {
      const ex = teamMap.get(t.teamName) ?? {
        teamName: t.teamName,
        hours: 0,
        gewerkt_hours: 0,
        staff_count: 0,
      }
      ex.hours = round2(ex.hours + t.hours)
      ex.gewerkt_hours = round2(ex.gewerkt_hours + t.gewerkt_hours)
      ex.staff_count += t.staff_count
      teamMap.set(t.teamName, ex)
    }
    cur.teams = [...teamMap.values()].sort((a, b) => a.teamName.localeCompare(b.teamName))
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export async function fetchStaffTimeseries(
  db: Db,
  ctx: DailyOpsStaffQueryContext,
  granularity: 'day' | 'week' | 'month' | 'year' = 'day',
): Promise<DailyOpsStaffTimeseriesDto> {
  const rows = await fetchStaffDailyLaborRows(db, ctx.startDate, ctx.endDate, ctx.locationId)
  const daily = aggregateDailyRows(rows)
  const aggregated = aggregatePoints(daily, granularity)
  const current =
    granularity === 'day'
      ? aggregated
      : fillBucketGaps(aggregated, ctx.startDate, ctx.endDate, granularity)

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
        const locPoints = aggregatePoints(aggregateDailyRows(loc.rows), granularity)
        return {
          locationId: loc.locationId,
          locationName: loc.locationName,
          points:
            granularity === 'day'
              ? locPoints
              : fillBucketGaps(locPoints, ctx.startDate, ctx.endDate, granularity),
          totals: {
            hours: round2(loc.rows.reduce((s, r) => s + r.gewerkt_hours, 0)),
            staff_count: Math.max(...aggregateDailyRows(loc.rows).map((p) => p.staff_count), 0),
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
