/**
 * @registry-id: dailyOpsDashboardBundleHourBundle
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-06-05T00:00:00.000Z
 * @description: Hourly revenue bundle from snapshot sections (no Bork on GET)
 * @last-fix: [2026-06-05] Fall back to revenue-section hourly when hourly section is empty
 * @adr-ref: ADR-004
 */

import type {
  DailyOpsSnapshotRevenueHourlySection,
  DailyOpsSnapshotRevenueSection,
} from '~/types/daily-ops-snapshot'
import type { BorkHourAggregatesBundle } from '../../dailyOpsMetrics/types'
import { rollupFoodBeverageFromCategories } from '../../borkFoodBeverageSplit'
import type { DailyOpsSnapshotRevenueProductsSection } from '~/types/daily-ops-snapshot'
import { snapshotRound2 } from './shared'

function sumHourlyRevenue(slots: DailyOpsSnapshotRevenueSection['hourly'] | undefined): number {
  return (slots ?? []).reduce((sum, slot) => sum + Number(slot.revenue?.ex_vat ?? 0), 0)
}

/** Prefer dedicated hourly section; fall back to revenue section when hourly rows are empty. */
export function mergeHourlySnapshotSections(
  hourly: DailyOpsSnapshotRevenueHourlySection[],
  revenue: DailyOpsSnapshotRevenueSection[],
): DailyOpsSnapshotRevenueHourlySection[] {
  const out = new Map<string, DailyOpsSnapshotRevenueHourlySection>()

  for (const doc of hourly) {
    out.set(`${doc.businessDate}|${doc.locationId}`, doc)
  }

  for (const doc of revenue) {
    const key = `${doc.businessDate}|${doc.locationId}`
    const existing = out.get(key)
    if (sumHourlyRevenue(existing?.hourly) > 0) continue

    const fallbackSlots = doc.hourly ?? []
    if (sumHourlyRevenue(fallbackSlots) <= 0 && existing) continue

    out.set(key, {
      businessDate: doc.businessDate,
      locationId: doc.locationId,
      locationName: doc.locationName ?? existing?.locationName ?? doc.locationId,
      hourly: sumHourlyRevenue(fallbackSlots) > 0 ? fallbackSlots : (existing?.hourly ?? []),
    })
  }

  return [...out.values()]
}

export function buildHourBundleFromSnapshots(
  hourly: DailyOpsSnapshotRevenueHourlySection[],
  revenue: DailyOpsSnapshotRevenueSection[],
): BorkHourAggregatesBundle {
  const hourOnly = new Map<number, number>()
  const byDayHour: BorkHourAggregatesBundle['byDayHour'] = []

  const ingestHourly = (
    businessDate: string,
    locationId: string,
    slots: DailyOpsSnapshotRevenueSection['hourly'],
  ) => {
    for (const slot of slots ?? []) {
      const h = Number(slot.calendar_hour)
      const rev = Number(slot.revenue?.ex_vat ?? 0)
      if (rev <= 0) continue
      hourOnly.set(h, (hourOnly.get(h) ?? 0) + rev)
      byDayHour.push({ _id: { d: businessDate, h, loc: locationId }, revenue: rev })
    }
  }

  for (const doc of mergeHourlySnapshotSections(hourly, revenue)) {
    ingestHourly(doc.businessDate, doc.locationId, doc.hourly)
  }

  return {
    byHourOnly: [...hourOnly.entries()].map(([_id, amount]) => ({ _id, amount })),
    byDayHour,
  }
}

export function categoryTotalsFromProducts(
  products: DailyOpsSnapshotRevenueProductsSection[],
): { food: number; drinks: number } {
  let food = 0
  let drinks = 0
  for (const doc of products) {
    const split = rollupFoodBeverageFromCategories(
      (doc.categories ?? []).map((c) => ({ name: c.name, revenue_ex_vat: c.revenue_ex_vat })),
    )
    food += split.food
    drinks += split.beverage
  }
  return { food: snapshotRound2(food), drinks: snapshotRound2(drinks) }
}
