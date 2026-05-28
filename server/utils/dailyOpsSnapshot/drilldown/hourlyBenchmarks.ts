/**
 * @registry-id: dailyOpsRevenueDrilldownHourlyBenchmarks
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T12:00:00.000Z
 * @description: Last-5 same-weekday hourly revenue benchmarks for drilldown
 * @last-fix: [2026-05-28] Multi-day ranges: sum per-weekday medians to match aggregated hourly totals
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/drilldown/buildRevenueDrilldownHourly.ts
 * ✓ server/utils/dailyOpsSnapshot/buildRevenueDrilldownSection.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsRevenueDrilldownStatus } from '~/types/daily-ops-dashboard'
import {
  DAILY_OPS_SNAPSHOT_COLLECTIONS,
  type DailyOpsSnapshotRevenueHourlySection,
  type DailyOpsSnapshotRevenueSection,
} from '~/types/daily-ops-snapshot'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { eachBusinessDate } from '../../dailyOpsRevenue/dateRange'
import type { DailyOpsMetricsContext } from '../../dailyOpsDashboardMetrics'
import { locDayKey, round2 } from './drilldownShared'

const LOOKBACK_WEEKDAYS = 5

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

export function benchmarkStatus(revenue: number, benchmark: number | null): DailyOpsRevenueDrilldownStatus {
  if (benchmark == null || benchmark <= 0 || revenue === 0) return 'neutral'
  return revenue >= benchmark ? 'above' : 'below'
}

function collectLookbackDates(rangeDays: string[]): string[] {
  const set = new Set<string>(rangeDays)
  for (const d of rangeDays) {
    for (const lb of sameWeekdayLookbackDates(d, LOOKBACK_WEEKDAYS)) {
      set.add(lb)
    }
  }
  return [...set]
}

async function loadRevenueByDateHour(
  db: Db,
  dates: string[],
  locationId: string | undefined,
): Promise<Map<string, number>> {
  if (dates.length === 0) return new Map()
  const filter: Record<string, unknown> = { businessDate: { $in: dates } }
  if (locationId) filter.locationId = locationId

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
    for (const slot of doc.hourly ?? []) {
      const hour = Number(slot.calendar_hour)
      const revenue = Number(slot.revenue?.ex_vat ?? 0)
      if (!Number.isFinite(hour) || revenue <= 0) continue
      const key = `${doc.businessDate}|${hour}`
      dayHourTotals.set(key, (dayHourTotals.get(key) ?? 0) + revenue)
    }
  }
  return dayHourTotals
}

export async function loadHourlyBenchmarks(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<Map<number, number>> {
  const rangeDays = [...eachBusinessDate(ctx.startDate, ctx.endDate)]
  if (rangeDays.length === 0) return new Map()

  const lookbackDates = collectLookbackDates(rangeDays)
  const revenueByDateHour = await loadRevenueByDateHour(db, lookbackDates, ctx.locationId)

  const out = new Map<number, number>()
  for (let hour = 0; hour < 24; hour += 1) {
    let benchmarkTotal = 0
    for (const businessDate of rangeDays) {
      const values: number[] = []
      for (const lookbackDate of sameWeekdayLookbackDates(businessDate, LOOKBACK_WEEKDAYS)) {
        const revenue = revenueByDateHour.get(`${lookbackDate}|${hour}`) ?? 0
        if (revenue > 0) values.push(revenue)
      }
      const m = median(values)
      if (m != null) benchmarkTotal += m
    }
    if (benchmarkTotal > 0) out.set(hour, round2(benchmarkTotal))
  }
  return out
}
