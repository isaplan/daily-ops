/**
 * @registry-id: dailyOpsRevenueDrilldownSpaces
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Space/table revenue rollup for revenue drilldown
 * @adr-ref: ADR-004
 */

import type { DailyOpsRevenueDrilldownDto } from '~/types/daily-ops-dashboard'
import type { BuildRevenueDrilldownInput } from './drilldownShared'
import { round2 } from './drilldownShared'

export function buildRevenueDrilldownSpaces(
  input: BuildRevenueDrilldownInput,
): DailyOpsRevenueDrilldownDto['spaces'] {
  const venueTotals = new Map<string, number>()
  const spaces = new Map<
    string,
    { locationId: string; locationName: string; spaceName: string; revenue: number; quantity: number }
  >()
  for (const doc of input.tables) {
    for (const table of doc.tables ?? []) {
      const revenue = Number(table.revenue_ex_vat ?? 0)
      const quantity = Number(table.quantity ?? 0)
      venueTotals.set(doc.locationId, (venueTotals.get(doc.locationId) ?? 0) + revenue)
      const spaceName = String(table.locationSpace ?? '').trim() || 'Unknown'
      const key = `${doc.locationId}|${spaceName}`
      const prev = spaces.get(key) ?? {
        locationId: doc.locationId,
        locationName: doc.locationName,
        spaceName,
        revenue: 0,
        quantity: 0,
      }
      prev.revenue += revenue
      prev.quantity += quantity
      spaces.set(key, prev)
    }
  }
  return [...spaces.values()]
    .map((space) => ({
      locationId: space.locationId,
      locationName: space.locationName,
      spaceName: space.spaceName,
      revenue: round2(space.revenue),
      quantity: round2(space.quantity),
      pctOfVenueRevenue:
        (venueTotals.get(space.locationId) ?? 0) > 0
          ? round2((space.revenue / (venueTotals.get(space.locationId) ?? 1)) * 100)
          : null,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}
