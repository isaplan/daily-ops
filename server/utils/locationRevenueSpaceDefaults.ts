/**
 * @registry-id: locationRevenueSpaceDefaults
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Default table→space mappings per venue (Kinsbergen, Bar Bea, L'Amour)
 * @last-fix: [2026-05-28] Initial venue-specific defaults
 *
 * @exports-to:
 * ✓ server/utils/locationSpaceResolver.ts
 * ✓ server/api/locations/[id]/revenue-spaces.get.ts
 */

import type { LocationRevenueSpace } from '../../types/location-revenue-spaces'

const OVERIG: LocationRevenueSpace = {
  id: 'overig',
  name: 'Overig',
  tableRanges: [],
  individualTables: [],
}

export const LOCATION_REVENUE_SPACE_DEFAULTS: Record<string, LocationRevenueSpace[]> = {
  '69d6cfa63d2adf93b79d1ae7': [
    {
      id: 'restaurant',
      name: 'Restaurant',
      tableRanges: [{ min: 1, max: 40 }],
      individualTables: [152, 153, 154],
    },
    { id: 'bar', name: 'Bar', tableRanges: [{ min: 1001, max: 1030 }], individualTables: [] },
    { id: 'gevel', name: 'Gevel', tableRanges: [{ min: 100, max: 110 }], individualTables: [] },
    { id: 'parkeer', name: 'Parkeer', tableRanges: [{ min: 200, max: 299 }], individualTables: [] },
    { id: 'terras-sun', name: 'Terras Sun', tableRanges: [{ min: 300, max: 399 }, { min: 700, max: 799 }], individualTables: [] },
    {
      id: 'terras-parasol',
      name: 'Terras Parasol',
      tableRanges: [{ min: 400, max: 499 }, { min: 500, max: 599 }, { min: 600, max: 699 }],
      individualTables: [],
    },
    OVERIG,
  ],
  '69d6cfa63d2adf93b79d1ae6': [
    { id: 'bar', name: 'Bar', tableRanges: [{ min: 1001, max: 1020 }], individualTables: [] },
    { id: 'binnen-groen', name: 'Binnen Groen', tableRanges: [{ min: 1, max: 18 }], individualTables: [] },
    { id: 'binnen-rood', name: 'Binnen Rood', tableRanges: [{ min: 20, max: 30 }], individualTables: [] },
    { id: 'gevel', name: 'Gevel', tableRanges: [{ min: 100, max: 105 }], individualTables: [] },
    { id: 'kade', name: 'Kade', tableRanges: [{ min: 106, max: 115 }, { min: 200, max: 215 }], individualTables: [] },
    { id: 'boot', name: 'Boot', tableRanges: [{ min: 120, max: 135 }], individualTables: [] },
    OVERIG,
  ],
  '69d6cfa73d2adf93b79d1ae8': [
    { id: 'binnen-rood', name: 'Binnen Rood', tableRanges: [{ min: 1, max: 9 }], individualTables: [] },
    { id: 'binnen-boots', name: 'Binnen Boots', tableRanges: [], individualTables: [10, 11, 12, 13] },
    { id: 'binnen-blue', name: 'Binnen Blue', tableRanges: [{ min: 14, max: 43 }], individualTables: [] },
    { id: 'bar', name: 'Bar', tableRanges: [{ min: 1001, max: 1025 }], individualTables: [] },
    { id: 'gevel', name: 'Gevel', tableRanges: [{ min: 100, max: 110 }], individualTables: [] },
    { id: 'parkeer', name: 'Parkeer', tableRanges: [{ min: 111, max: 140 }], individualTables: [] },
    { id: 'terras-zon', name: 'Terras Zon', tableRanges: [{ min: 300, max: 399 }, { min: 700, max: 799 }], individualTables: [] },
    {
      id: 'terras-parasol',
      name: 'Terras Parasol',
      tableRanges: [{ min: 400, max: 499 }, { min: 500, max: 599 }, { min: 600, max: 699 }],
      individualTables: [],
    },
    OVERIG,
  ],
}

export function defaultRevenueSpacesForLocation(
  locationId: string,
  locationName?: string,
): LocationRevenueSpace[] | null {
  const byId = LOCATION_REVENUE_SPACE_DEFAULTS[locationId]
  if (byId) {
    return byId.map((s) => ({
      id: s.id,
      name: s.name,
      tableRanges: s.tableRanges.map((r) => ({ ...r })),
      individualTables: [...s.individualTables],
    }))
  }
  const normalized = String(locationName ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
  if (!normalized) return null
  const nameKey =
    normalized.includes('kinsbergen') ? '69d6cfa63d2adf93b79d1ae7'
    : normalized.includes('barbea') || normalized.includes('barbea') ? '69d6cfa63d2adf93b79d1ae6'
    : normalized.includes('lamour') || normalized.includes('amour') ? '69d6cfa73d2adf93b79d1ae8'
    : null
  if (!nameKey) return null
  return defaultRevenueSpacesForLocation(nameKey)
}
