/**
 * @registry-id: dailyOpsRevenueDrilldownHourlyBenchmarks
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Last-5 same-weekday hourly revenue benchmarks for drilldown
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
import type { DailyOpsMetricsContext } from '../../dailyOpsDashboardMetrics'
import { locDayKey, round2 } from './drilldownShared'

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
