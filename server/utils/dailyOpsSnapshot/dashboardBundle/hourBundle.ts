/**
 * @registry-id: dailyOpsDashboardBundleHourBundle
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Hourly revenue bundle from snapshot sections (no Bork on GET)
 * @adr-ref: ADR-004
 */

import type {
  DailyOpsSnapshotRevenueHourlySection,
  DailyOpsSnapshotRevenueSection,
} from '~/types/daily-ops-snapshot'
import type { BorkHourAggregatesBundle } from '../../dailyOpsDashboardMetrics'
import { rollupFoodBeverageFromCategories } from '../../borkFoodBeverageSplit'
import type { DailyOpsSnapshotRevenueProductsSection } from '~/types/daily-ops-snapshot'
import { round2 } from './shared'

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

  for (const doc of hourly) ingestHourly(doc.businessDate, doc.locationId, doc.hourly)
  for (const doc of revenue) {
    if (hourly.some((h) => h.businessDate === doc.businessDate && h.locationId === doc.locationId)) continue
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
  return { food: round2(food), drinks: round2(drinks) }
}
