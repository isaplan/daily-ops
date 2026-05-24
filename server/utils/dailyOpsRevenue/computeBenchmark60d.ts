/**
 * @registry-id: dailyOpsRevenueBenchmark60d
 * @created: 2026-05-22T12:00:00.000Z
 * @last-modified: 2026-05-23T00:00:00.000Z
 * @description: 60-day rolling averages for revenue KPI benchmarks (precompute at write per ADR-006)
 * @last-fix: [2026-05-24] ADR-006 — two queries max; move to snapshot write in Phase A
 * @adr-ref: ADR-006
 *
 * @exports-to:
 * ✓ server/api/daily-ops/revenue/summary.get.ts
 */

import type { Db } from 'mongodb'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { eachBusinessDate } from './dateRange'
import { fetchRevenueDailyMap } from './fetchRevenueDailySeries'

const BENCHMARK_DAYS = 60

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type RevenueBenchmark60d = {
  avgDailyRevenue: number
  avgDailyItems: number
  avgRevenuePerItem: number
  calendarDays: number
}

export async function computeBenchmark60d(
  db: Db,
  endDate: string,
  locationId?: string,
): Promise<RevenueBenchmark60d> {
  const startDate = addCalendarDaysYmd(endDate, -(BENCHMARK_DAYS - 1))
  const byDate = await fetchRevenueDailyMap(db, startDate, endDate, locationId)

  let totalRevenue = 0
  let totalItems = 0
  let calendarDays = 0

  for (const date of eachBusinessDate(startDate, endDate)) {
    calendarDays++
    const p = byDate.get(date)
    totalRevenue += p?.revenue ?? 0
    totalItems += p?.itemsCount ?? 0
  }

  const days = calendarDays || 1
  return {
    avgDailyRevenue: round2(totalRevenue / days),
    avgDailyItems: round2(totalItems / days),
    avgRevenuePerItem: totalItems > 0 ? round2(totalRevenue / totalItems) : 0,
    calendarDays: days,
  }
}

export function buildKpiVsBenchmark(
  value: number,
  benchmark: number,
): { value: number; benchmark: number; delta: number; pct: number | null; above: boolean } {
  const delta = round2(value - benchmark)
  const pct =
    benchmark !== 0 ? Math.round(((value - benchmark) / benchmark) * 10000) / 100 : null
  return {
    value,
    benchmark,
    delta,
    pct,
    above: value >= benchmark,
  }
}
