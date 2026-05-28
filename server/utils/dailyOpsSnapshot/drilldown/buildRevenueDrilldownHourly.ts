/**
 * @registry-id: dailyOpsRevenueDrilldownHourly
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Hourly rows + same-weekday benchmarks for revenue drilldown
 * @adr-ref: ADR-004
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsRevenueDrilldownHourlyRowDto,
  DailyOpsRevenueDrilldownStatus,
} from '~/types/daily-ops-dashboard'
import {
  DAILY_OPS_SNAPSHOT_COLLECTIONS,
  type DailyOpsSnapshotRevenueHourlySection,
  type DailyOpsSnapshotRevenueSection,
} from '~/types/daily-ops-snapshot'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import {
  MOST_PROFITABLE_HOUR_DEFAULTS,
  type DailyOpsMetricsContext,
} from '../../dailyOpsDashboardMetrics'
import { VENUE_STRIP_LOCATIONS } from '../../dailyOpsVenueStrip'
import type { BuildRevenueDrilldownInput } from './drilldownShared'
import { hourLabel, locDayKey, locHourKey, revenueScale, round2 } from './drilldownShared'

function dateWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

function sameWeekdayLookbackDates(date: string, count: number): string[] {
  const out: string[] = []
  let cursor = date
  for (let i = 0; i < count; i += 1) {
    cursor = addCalendarDaysYmd(cursor, -7)
    out.push(cursor)
  }
  return out
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const hi = sorted[mid] ?? 0
  if (sorted.length % 2 === 1) return hi
  const lo = sorted[mid - 1] ?? hi
  return (lo + hi) / 2
}

function benchmarkStatus(revenue: number, benchmark: number | null): DailyOpsRevenueDrilldownStatus {
  if (benchmark == null || benchmark <= 0 || revenue === 0) return 'neutral'
  return revenue >= benchmark ? 'above' : 'below'
}

export async function loadHourlyBenchmarks(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<Map<number, number>> {
  if (ctx.startDate !== ctx.endDate) return new Map()
  const lookbackDates = sameWeekdayLookbackDates(ctx.startDate, 5)
  const expectedWeekday = dateWeekday(ctx.startDate)
  const filter: Record<string, unknown> = { businessDate: { $in: lookbackDates } }
  if (ctx.locationId) filter.locationId = ctx.locationId
  const [hourlyDocs, revenueDocs] = await Promise.all([
    db
      .collection<DailyOpsSnapshotRevenueHourlySection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueHourlySection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection)
      .find(filter)
      .toArray(),
  ])

  const valuesByHour = new Map<number, number[]>()
  const dayHourTotals = new Map<string, number>()
  const coveredLocDays = new Set(hourlyDocs.map((doc) => locDayKey(doc.businessDate, doc.locationId)))
  const benchmarkDocs = [
    ...hourlyDocs.map((doc) => ({
      businessDate: doc.businessDate,
      locationId: doc.locationId,
      hourly: doc.hourly,
    })),
    ...revenueDocs
      .filter((doc) => !coveredLocDays.has(locDayKey(doc.businessDate, doc.locationId)))
      .map((doc) => ({
        businessDate: doc.businessDate,
        locationId: doc.locationId,
        hourly: doc.hourly,
      })),
  ]

  for (const doc of benchmarkDocs) {
    if (dateWeekday(doc.businessDate) !== expectedWeekday) continue
    for (const slot of doc.hourly ?? []) {
      const hour = Number(slot.calendar_hour)
      const revenue = Number(slot.revenue?.ex_vat ?? 0)
      if (!Number.isFinite(hour) || revenue <= 0) continue
      const key = `${doc.businessDate}|${hour}`
      dayHourTotals.set(key, (dayHourTotals.get(key) ?? 0) + revenue)
    }
  }
  for (const [key, revenue] of dayHourTotals) {
    const [, hourRaw = ''] = key.split('|')
    const hour = Number(hourRaw)
    if (!Number.isFinite(hour)) continue
    const values = valuesByHour.get(hour) ?? []
    values.push(revenue)
    valuesByHour.set(hour, values)
  }

  const out = new Map<number, number>()
  for (const [hour, values] of valuesByHour) {
    const m = median(values)
    if (m != null) out.set(hour, round2(m))
  }
  return out
}

export function buildHourlyRows(
  ctx: DailyOpsMetricsContext,
  input: BuildRevenueDrilldownInput,
  hourlyBenchmarks: Map<number, number>,
): DailyOpsRevenueDrilldownHourlyRowDto[] {
  const rawByLocDay = new Map<string, number>()
  for (const doc of input.hourly) {
    for (const slot of doc.hourly ?? []) {
      rawByLocDay.set(
        locDayKey(doc.businessDate, doc.locationId),
        (rawByLocDay.get(locDayKey(doc.businessDate, doc.locationId)) ?? 0) + Number(slot.revenue?.ex_vat ?? 0),
      )
    }
  }

  const byHourLoc = new Map<string, { locationName: string; revenue: number; laborCost: number }>()
  for (const doc of input.hourly) {
    if (doc.businessDate < ctx.startDate || doc.businessDate > ctx.endDate) continue
    const scale = revenueScale(doc.businessDate, doc.locationId, rawByLocDay, input.headlineRevenueByLocDay)
    for (const slot of doc.hourly ?? []) {
      const hour = Number(slot.calendar_hour)
      if (!Number.isFinite(hour)) continue
      const key = `${hour}|${doc.locationId}`
      const prev = byHourLoc.get(key) ?? { locationName: doc.locationName, revenue: 0, laborCost: 0 }
      prev.revenue += Number(slot.revenue?.ex_vat ?? 0) * scale
      prev.laborCost += input.laborByLocHour.get(locHourKey(doc.locationId, doc.businessDate, hour))?.loadedCost ?? 0
      byHourLoc.set(key, prev)
    }
  }

  const catTotal = input.categoryTotals.food + input.categoryTotals.drinks
  const foodShare = catTotal > 0 ? input.categoryTotals.food / catTotal : 0.5
  const rows: DailyOpsRevenueDrilldownHourlyRowDto[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    const locations = VENUE_STRIP_LOCATIONS.map((location) => {
      const found = byHourLoc.get(`${hour}|${location.locationId}`)
      const revenue = round2(found?.revenue ?? 0)
      const laborCost = round2(found?.laborCost ?? 0)
      const foodRev = revenue * foodShare
      const bevRev = revenue - foodRev
      const cogsCost = round2(
        foodRev * MOST_PROFITABLE_HOUR_DEFAULTS.foodCogsPct +
          bevRev * MOST_PROFITABLE_HOUR_DEFAULTS.beverageCogsPct,
      )
      const fixedCost = round2(revenue * MOST_PROFITABLE_HOUR_DEFAULTS.fixedOverheadPct)
      return {
        locationId: location.locationId,
        locationName: found?.locationName ?? location.locationName,
        revenue,
        laborCost,
        profit: round2(revenue - laborCost - cogsCost - fixedCost),
      }
    })
    const revenue = round2(locations.reduce((sum, row) => sum + row.revenue, 0))
    const laborCost = round2(locations.reduce((sum, row) => sum + row.laborCost, 0))
    const foodRev = revenue * foodShare
    const bevRev = revenue - foodRev
    const cogsCost = round2(
      foodRev * MOST_PROFITABLE_HOUR_DEFAULTS.foodCogsPct +
        bevRev * MOST_PROFITABLE_HOUR_DEFAULTS.beverageCogsPct,
    )
    const fixedCost = round2(revenue * MOST_PROFITABLE_HOUR_DEFAULTS.fixedOverheadPct)
    const benchmarkRevenue = hourlyBenchmarks.get(hour) ?? null
    rows.push({
      calendarHour: hour,
      hourLabel: hourLabel(hour),
      revenue,
      laborCost,
      cogsCost,
      fixedCost,
      profit: round2(revenue - laborCost - cogsCost - fixedCost),
      benchmarkRevenue,
      benchmarkDelta: benchmarkRevenue != null ? round2(revenue - benchmarkRevenue) : null,
      benchmarkStatus: benchmarkStatus(revenue, benchmarkRevenue),
      locations,
    })
  }
  return rows
}
