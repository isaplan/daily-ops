/**
 * @registry-id: dailyOpsRevenueLocationSpaces
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-05-20T00:00:00.000Z
 * @description: Hardcoded table → location space (bar / restaurant / terras) for VKB-style layouts
 * @last-fix: [2026-05-20] Initial mapping
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/buildRevenueTablesSection.ts
 * ✓ server/utils/dailyOpsRevenue/fetchLocationSpace.ts
 */

export type LocationSpaceId = 'bar' | 'restaurant' | 'terras' | 'overig'

const BAR_RANGES: Array<[number, number]> = [
  [99, 99],
  [100, 145],
  [1000, 1026],
]

const RESTAURANT_RANGES: Array<[number, number]> = [[1, 43]]

const TERRAS_RANGES: Array<[number, number]> = [
  [200, 226],
  [300, 311],
  [400, 411],
  [500, 509],
  [600, 607],
  [700, 711],
  [800, 810],
  [900, 910],
  [2000, 2006],
  [3001, 3004],
  [4000, 4000],
  [5000, 5005],
  [6000, 6001],
  [7001, 7010],
  [9004, 9050],
]

function inRanges(n: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([a, b]) => n >= a && n <= b)
}

export function getLocationSpaceForTable(tableNum: string | number | null | undefined): LocationSpaceId {
  const n = Number(tableNum)
  if (!Number.isFinite(n) || n <= 0) return 'overig'
  if (inRanges(n, BAR_RANGES)) return 'bar'
  if (inRanges(n, RESTAURANT_RANGES)) return 'restaurant'
  if (inRanges(n, TERRAS_RANGES)) return 'terras'
  return 'overig'
}

export const LOCATION_SPACE_LABELS: Record<LocationSpaceId, string> = {
  bar: 'Bar',
  restaurant: 'Restaurant',
  terras: 'Terras',
  overig: 'Overig',
}
