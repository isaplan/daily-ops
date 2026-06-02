import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from './dailyOpsProfitIntervals'

const VENUE_ORDER = new Map(
  DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((venue, index) => [venue.locationId, index]),
)

export function venueOrderIndex (locationId: string): number {
  return VENUE_ORDER.get(locationId) ?? 999
}

export function sortRevenueDrilldownSpaceRows<T extends { locationId: string; revenue: number }> (
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const byVenue = venueOrderIndex(a.locationId) - venueOrderIndex(b.locationId)
    if (byVenue !== 0) return byVenue
    return b.revenue - a.revenue
  })
}
