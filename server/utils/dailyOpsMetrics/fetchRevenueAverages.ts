/**
 * @registry-id: fetchRevenueAverages
 * @created: 2026-07-25T11:20:00.000Z
 * @last-modified: 2026-08-09T15:50:00.000Z
 * @description: Period-cache revenue averages + YoY for dashboard period
 * @last-fix: [2026-08-09] ZERO GET — period-cache day nodes (no snapshot revenue section)
 * @adr-ref: ADR-004, ADR-006, PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/revenue-averages.get.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsRevenueAveragesDto,
  RevenueAverageCompareSlice,
  RevenueAverageVenueDto,
} from '~/types/revenue-averages'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import { DAILY_OPS_PERIOD_CACHE_COLLECTION } from '../dailyOpsPeriodCache/store'
import type { DailyOpsPeriodNode } from '~/types/daily-ops-period-cache'
import {
  averageLabel,
  classifyAverageKind,
  priorMonthRanges,
  priorWeekRanges,
  sameDayLastYear,
  sameMonthLastYear,
  sameWeekLastYear,
  sameWeekdayLookbackDates,
  weekdayLabelForYmd,
  yearAgoLabel,
  type DateRange,
} from './revenueAverageWindows'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function round1 (n: number): number {
  return Math.round(n * 10) / 10
}

function pctVs (current: number, compare: number): number | null {
  if (compare <= 0) return null
  return round1(((current - compare) / compare) * 100)
}

function collectDatesFromRanges (ranges: DateRange[]): string[] {
  const set = new Set<string>()
  for (const r of ranges) {
    let cursor = r.startDate
    while (cursor <= r.endDate) {
      set.add(cursor)
      const [y, m, d] = cursor.split('-').map(Number)
      const next = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1))
      cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
    }
  }
  return [...set]
}

type LocDayKey = string

function locDay (locationId: string, date: string): LocDayKey {
  return `${locationId}|${date}`
}

async function loadRevenueMap (
  db: Db,
  dates: string[],
  locationIds: string[],
): Promise<Map<LocDayKey, number>> {
  const out = new Map<LocDayKey, number>()
  if (!dates.length || !locationIds.length) return out

  const rows = await db
    .collection(DAILY_OPS_PERIOD_CACHE_COLLECTION)
    .find({
      level: 'day',
      periodKey: { $in: dates },
      locationId: { $in: locationIds },
    })
    .project({ periodKey: 1, locationId: 1, 'revenue.exVat': 1 })
    .toArray()

  for (const row of rows) {
    const node = row as unknown as Pick<DailyOpsPeriodNode, 'periodKey' | 'locationId' | 'revenue'>
    const rev = Number(node.revenue?.exVat ?? 0)
    if (rev > 0) out.set(locDay(node.locationId, node.periodKey), rev)
  }
  return out
}

function sumRange (
  map: Map<LocDayKey, number>,
  locationId: string | null,
  range: DateRange,
  locationIds: string[],
): number {
  let total = 0
  let cursor = range.startDate
  while (cursor <= range.endDate) {
    if (locationId) {
      total += map.get(locDay(locationId, cursor)) ?? 0
    } else {
      for (const id of locationIds) total += map.get(locDay(id, cursor)) ?? 0
    }
    const [y, m, d] = cursor.split('-').map(Number)
    const next = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1))
    cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
  }
  return round2(total)
}

function averageFromDayList (
  map: Map<LocDayKey, number>,
  locationId: string | null,
  dates: string[],
  locationIds: string[],
  expected: number,
  label: string,
  current: number,
): RevenueAverageCompareSlice | null {
  const values: number[] = []
  for (const d of dates) {
    let dayTotal = 0
    if (locationId) {
      dayTotal = map.get(locDay(locationId, d)) ?? 0
    } else {
      for (const id of locationIds) dayTotal += map.get(locDay(id, d)) ?? 0
    }
    if (dayTotal > 0) values.push(dayTotal)
  }
  if (!values.length) return null
  const avg = round2(values.reduce((a, b) => a + b, 0) / values.length)
  return {
    revenue: avg,
    samples: values.length,
    expectedSamples: expected,
    pctVsCurrent: pctVs(current, avg),
    label,
  }
}

function averageFromRanges (
  map: Map<LocDayKey, number>,
  locationId: string | null,
  ranges: DateRange[],
  locationIds: string[],
  expected: number,
  label: string,
  current: number,
): RevenueAverageCompareSlice | null {
  const values: number[] = []
  for (const range of ranges) {
    const total = sumRange(map, locationId, range, locationIds)
    if (total > 0) values.push(total)
  }
  if (!values.length) return null
  const avg = round2(values.reduce((a, b) => a + b, 0) / values.length)
  return {
    revenue: avg,
    samples: values.length,
    expectedSamples: expected,
    pctVsCurrent: pctVs(current, avg),
    label,
  }
}

function yearAgoSlice (
  map: Map<LocDayKey, number>,
  locationId: string | null,
  range: DateRange,
  locationIds: string[],
  label: string,
  current: number,
): RevenueAverageCompareSlice | null {
  const revenue = sumRange(map, locationId, range, locationIds)
  if (revenue <= 0) return null
  return {
    revenue,
    samples: 1,
    expectedSamples: 1,
    pctVsCurrent: pctVs(current, revenue),
    label,
  }
}

function venueDto (
  locationId: string | null,
  locationName: string,
  current: number,
  average: RevenueAverageCompareSlice | null,
  yearAgo: RevenueAverageCompareSlice | null,
): RevenueAverageVenueDto {
  return { locationId, locationName, currentRevenue: current, average, yearAgo }
}

export async function fetchRevenueAverages (
  db: Db,
  input: {
    period: string
    anchor?: string | null
    currentRevenueByLocationId?: Record<string, number>
    combinedRevenue?: number
  },
): Promise<DailyOpsRevenueAveragesDto> {
  const range = resolveDailyOpsPeriod(input.period, input.anchor ?? undefined)
  const kind = classifyAverageKind(input.period)
  const endYmd = range.endDate
  const locationIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const weekdayName = weekdayLabelForYmd(endYmd)
  const avgLabel = averageLabel(kind, weekdayName)
  const lyLabel = yearAgoLabel(kind)

  let avgDates: string[] = []
  let avgRanges: DateRange[] = []
  let yoyRange: DateRange

  if (kind === 'weekday') {
    avgDates = sameWeekdayLookbackDates(endYmd, 6)
    yoyRange = { startDate: sameDayLastYear(endYmd), endDate: sameDayLastYear(endYmd) }
  } else if (kind === 'weeks') {
    avgRanges = priorWeekRanges(endYmd, 6)
    yoyRange = sameWeekLastYear(endYmd)
  } else {
    avgRanges = priorMonthRanges(endYmd, 3)
    yoyRange = sameMonthLastYear(endYmd)
  }

  const allDates = [
    ...avgDates,
    ...collectDatesFromRanges(avgRanges),
    ...collectDatesFromRanges([yoyRange]),
    ...collectDatesFromRanges([{ startDate: range.startDate, endDate: range.endDate }]),
  ]
  const uniqueDates = [...new Set(allDates)]
  const map = await loadRevenueMap(db, uniqueDates, locationIds)

  const currentByLoc = (id: string): number => {
    const fromInput = input.currentRevenueByLocationId?.[id]
    if (fromInput != null && Number.isFinite(fromInput)) return round2(fromInput)
    return sumRange(map, id, { startDate: range.startDate, endDate: range.endDate }, locationIds)
  }

  const combinedCurrent = input.combinedRevenue != null && Number.isFinite(input.combinedRevenue)
    ? round2(input.combinedRevenue)
    : round2(locationIds.reduce((s, id) => s + currentByLoc(id), 0))

  const buildFor = (locationId: string | null, locationName: string, current: number): RevenueAverageVenueDto => {
    const average = kind === 'weekday'
      ? averageFromDayList(map, locationId, avgDates, locationIds, 6, avgLabel, current)
      : averageFromRanges(
          map,
          locationId,
          avgRanges,
          locationIds,
          kind === 'weeks' ? 6 : 3,
          avgLabel,
          current,
        )
    const yearAgo = yearAgoSlice(map, locationId, yoyRange, locationIds, lyLabel, current)
    return venueDto(locationId, locationName, current, average, yearAgo)
  }

  const byVenue = VENUE_STRIP_LOCATIONS.map((v) =>
    buildFor(v.locationId, v.locationName, currentByLoc(v.locationId)),
  )

  return {
    period: input.period,
    kind,
    combined: buildFor(null, 'Combined', combinedCurrent),
    byVenue,
  }
}
