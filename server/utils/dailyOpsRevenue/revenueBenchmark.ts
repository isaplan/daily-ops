/**
 * @registry-id: dailyOpsRevenueBenchmark
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Precomputed 60-day revenue benchmark — write at snapshot seal, read on summary GET (ADR-006)
 * @last-fix: [2026-05-28] Hot-tier benchmark collection; no 60d scan on GET when doc exists
 * @adr-ref: ADR-006
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 * ✓ server/api/daily-ops/revenue/summary.get.ts
 */

import type { Db } from 'mongodb'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import { computeBenchmark60d, type RevenueBenchmark60d } from './computeBenchmark60d'

export const REVENUE_BENCHMARK_COLLECTION = 'daily_ops_revenue_benchmark'
export const REVENUE_BENCHMARK_WINDOW_DAYS = 60

export type RevenueBenchmarkDoc = RevenueBenchmark60d & {
  locationId: string | null
  asOfDate: string
  windowDays: number
  lastBuiltAt: Date
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Upsert 60d rolling benchmark after snapshot write/seal. */
export async function writeRevenueBenchmarkForLocation(
  db: Db,
  asOfDate: string,
  locationId: string,
): Promise<void> {
  const bench = await computeBenchmark60d(db, asOfDate, locationId)
  const doc: RevenueBenchmarkDoc = {
    locationId,
    asOfDate,
    windowDays: REVENUE_BENCHMARK_WINDOW_DAYS,
    ...bench,
    lastBuiltAt: new Date(),
  }
  await db
    .collection(REVENUE_BENCHMARK_COLLECTION)
    .updateOne({ locationId, asOfDate, windowDays: REVENUE_BENCHMARK_WINDOW_DAYS }, { $set: doc }, { upsert: true })
}

/** Also write venue-agnostic benchmark (all locations) when any location seals. */
export async function writeRevenueBenchmarkAllLocations(db: Db, asOfDate: string): Promise<void> {
  const bench = await computeBenchmark60d(db, asOfDate, undefined)
  const doc: RevenueBenchmarkDoc = {
    locationId: null,
    asOfDate,
    windowDays: REVENUE_BENCHMARK_WINDOW_DAYS,
    ...bench,
    lastBuiltAt: new Date(),
  }
  await db
    .collection(REVENUE_BENCHMARK_COLLECTION)
    .updateOne(
      { locationId: null, asOfDate, windowDays: REVENUE_BENCHMARK_WINDOW_DAYS },
      { $set: doc },
      { upsert: true },
    )
}

/** Read precomputed benchmark; compute on-the-fly only when doc missing (backfill gap). */
export async function readRevenueBenchmark60d(
  db: Db,
  endDate: string,
  locationId?: string,
): Promise<RevenueBenchmark60d> {
  const filter: Record<string, unknown> = {
    asOfDate: endDate,
    windowDays: REVENUE_BENCHMARK_WINDOW_DAYS,
    locationId: locationId ?? null,
  }
  const doc = (await db.collection(REVENUE_BENCHMARK_COLLECTION).findOne(filter)) as RevenueBenchmarkDoc | null
  if (doc) {
    return {
      avgDailyRevenue: round2(doc.avgDailyRevenue),
      avgDailyItems: round2(doc.avgDailyItems),
      avgRevenuePerItem: round2(doc.avgRevenuePerItem),
      calendarDays: doc.calendarDays,
    }
  }
  return computeBenchmark60d(db, endDate, locationId)
}

/** Bulk snapshot revenue map for worker-detail and other dashboard reads. */
export async function fetchSnapshotRevenueByDateAndLocation(
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<Map<string, number>> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: startDate, $lte: endDate },
  }
  if (locationId) filter.locationId = locationId
  const rows = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection).find(filter).toArray()
  const map = new Map<string, number>()
  for (const r of rows) {
    const doc = r as { businessDate: string; locationId: string; totals?: { ex_vat?: number } }
    map.set(`${doc.businessDate}|${doc.locationId}`, Number(doc.totals?.ex_vat ?? 0))
  }
  return map
}

export function benchmarkLookbackStart(asOfDate: string): string {
  return addCalendarDaysYmd(asOfDate, -(REVENUE_BENCHMARK_WINDOW_DAYS - 1))
}
