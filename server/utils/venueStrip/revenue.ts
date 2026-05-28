/**
 * @registry-id: dailyOpsVenueStripRevenue
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Venue-strip revenue + contract rollups from snapshot sections
 * @adr-ref: ADR-004
 */

import type { VenueStripCardDto, VenueStripTeamBucket } from '~/types/daily-ops-dashboard'
import type {
  DailyOpsSnapshotLaborSection,
  DailyOpsSnapshotRevenueProductsSection,
  DailyOpsSnapshotRevenueSection,
} from '~/types/daily-ops-snapshot'
import { proportionalFoodBeverageToHeadline, rollupFoodBeverageFromCategories } from '../borkFoodBeverageSplit'
import { bucketTeamFromName } from '../dailyOpsTeamBucket'
import { headlineExVatFromSnapshotSection } from '../dailyOpsSnapshot/snapshotHeadlineRevenue'

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
): { totalRevenue: number; food: number; beverage: number } {
  const totalRevenue = round2(headlineExVatFromSnapshotSection(rev))
  const split = rollupFoodBeverageFromCategories(
    (products?.categories ?? []).map((c) => ({ name: c.name, revenue_ex_vat: c.revenue_ex_vat })),
  )
  const scaled = proportionalFoodBeverageToHeadline(totalRevenue, split.food, split.beverage)
  return { totalRevenue, food: scaled.food, beverage: scaled.beverage }
}
