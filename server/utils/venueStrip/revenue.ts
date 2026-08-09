/**
 * @registry-id: dailyOpsVenueStripRevenue
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-08-09T00:30:00.000Z
 * @description: Venue-strip revenue + contract rollups from snapshot sections
 * @last-fix: [2026-08-09] Prefer period-cache food/bev when provided (PERIOD_CACHE_ADR L3)
 * @adr-ref: ADR-004, PERIOD_CACHE_ADR L3
 */

import type { VenueStripCardDto, VenueStripTeamBucket } from '~/types/daily-ops-dashboard'
import type {
  DailyOpsSnapshotLaborSection,
  DailyOpsSnapshotRevenueProductsSection,
  DailyOpsSnapshotRevenueSection,
} from '~/types/daily-ops-snapshot'
import { proportionalFoodBeverageToHeadline, rollupFoodBeverageFromCategories } from '../borkFoodBeverageSplit'
import { bucketTeamFromName } from '../dailyOpsTeamBucket'
import {
  headlineExVatFromSnapshotSection,
  headlineIncVatFromSnapshotSection,
} from '../dailyOpsSnapshot/snapshotHeadlineRevenue'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function contractsByTeamFromSnapshot(
  doc: DailyOpsSnapshotLaborSection | null,
): VenueStripCardDto['contractsByTeam'] {
  const out: VenueStripCardDto['contractsByTeam'] = { keuken: [], bediening: [], other: [] }
  if (!doc?.workers?.length) return out

  type Acc = { workers: Set<string>; hours: number; wages: number; loaded: number }
  const acc = new Map<string, Acc & { teamBucket: VenueStripTeamBucket; contractType: string }>()

  for (const w of doc.workers) {
    const teamBucket = bucketTeamFromName(String(w.teamName ?? ''))
    const contractType = String(w.contractType ?? '—').trim() || '—'
    const key = `${teamBucket}|${contractType}`
    let row = acc.get(key)
    if (!row) {
      row = { teamBucket, contractType, workers: new Set(), hours: 0, wages: 0, loaded: 0 }
      acc.set(key, row)
    }
    const hours = Number(w.hours ?? 0)
    if (hours <= 0) continue
    const uid = String(w.userId ?? '')
    if (uid) row.workers.add(uid)
    row.hours += hours
    row.wages += Number(w.wage_cost ?? 0)
    row.loaded += Number(w.loaded_cost ?? 0)
  }

  for (const row of acc.values()) {
    out[row.teamBucket].push({
      contractType: row.contractType,
      workers: row.workers.size,
      hours: round2(row.hours),
      wages: round2(row.wages),
      loaded: round2(row.loaded),
    })
  }
  for (const bucket of ['keuken', 'bediening', 'other'] as const) {
    out[bucket].sort((a, b) => b.loaded - a.loaded)
  }
  return out
}

export function revenueFromSnapshotSections(
  rev: DailyOpsSnapshotRevenueSection | null,
  products: DailyOpsSnapshotRevenueProductsSection | null,
  /** When set (from daily_ops_period_cache), skips local category rollup. */
  periodFoodBev?: { food: number; beverage: number } | null,
): {
  totalRevenue: number
  food: number
  beverage: number
  totalIncVat: number
  foodIncVat: number
  beverageIncVat: number
} {
  const totalRevenue = round2(headlineExVatFromSnapshotSection(rev))
  const totalIncVat = round2(headlineIncVatFromSnapshotSection(rev))
  const split = periodFoodBev
    ? { food: periodFoodBev.food, beverage: periodFoodBev.beverage }
    : rollupFoodBeverageFromCategories(
        (products?.categories ?? []).map((c) => ({ name: c.name, revenue_ex_vat: c.revenue_ex_vat })),
      )
  const scaled = proportionalFoodBeverageToHeadline(totalRevenue, split.food, split.beverage)
  const scaledInc = proportionalFoodBeverageToHeadline(totalIncVat, split.food, split.beverage)
  return {
    totalRevenue,
    food: scaled.food,
    beverage: scaled.beverage,
    totalIncVat,
    foodIncVat: scaledInc.food,
    beverageIncVat: scaledInc.beverage,
  }
}
