/**
 * @registry-id: dailyOpsRevenueDrilldownShared
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Shared types/helpers for revenue drilldown builders
 * @adr-ref: ADR-004
 */

import type {
  DailyOpsSnapshotRevenueHourlySection,
  DailyOpsSnapshotRevenueProductsSection,
  DailyOpsSnapshotRevenueSection,
  DailyOpsSnapshotRevenueTablesSection,
  DailyOpsSnapshotRevenueWorkersSection,
} from '~/types/daily-ops-snapshot'

export type LaborBucket = { loadedCost: number; hours: number }

export type BuildRevenueDrilldownInput = {
  revenue: DailyOpsSnapshotRevenueSection[]
  hourly: DailyOpsSnapshotRevenueHourlySection[]
  products: DailyOpsSnapshotRevenueProductsSection[]
  tables: DailyOpsSnapshotRevenueTablesSection[]
  workers: DailyOpsSnapshotRevenueWorkersSection[]
  laborByLocHour: Map<string, LaborBucket>
  headlineRevenueByLocDay: Map<string, number>
  categoryTotals: { food: number; drinks: number }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function locDayKey(date: string, locationId: string): string {
  return `${date}|${locationId}`
}

export function locHourKey(locationId: string, date: string, hour: number): string {
  return `${locationId}|${date}|${hour}`
}

export function revenueScale(
  date: string,
  locationId: string,
  rawByLocDay: Map<string, number>,
  headlineRevenueByLocDay: Map<string, number>,
): number {
  const key = locDayKey(date, locationId)
  const raw = rawByLocDay.get(key) ?? 0
  const target = headlineRevenueByLocDay.get(key) ?? 0
  if (raw > 0 && target > 0) return target / raw
  return 1
}
