/**
 * @registry-id: revenueAveragesTypes
 * @created: 2026-07-25T11:20:00.000Z
 * @last-modified: 2026-07-25T11:20:00.000Z
 * @description: Revenue average + YoY comparison DTOs for Daily Ops KPI / venue strip
 * @last-fix: [2026-07-25] Initial — rolling weekday/week/month avg + YoY
 * @adr-ref: ADR-004, ADR-014
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsMetrics/fetchRevenueAverages.ts
 * ✓ server/api/daily-ops/metrics/revenue-averages.get.ts
 * ✓ composables/useDailyOpsRevenueAverages.ts
 */

export type RevenueAverageKind = 'weekday' | 'weeks' | 'months'

export type RevenueAverageCompareSlice = {
  /** Average or YoY revenue € (ex VAT) */
  revenue: number
  /** Sample size (days / weeks / months found with data) */
  samples: number
  /** Expected sample size (6 / 6 / 3) */
  expectedSamples: number
  /** (current − compare) / compare × 100 — null if compare ≤ 0 */
  pctVsCurrent: number | null
  label: string
}

export type RevenueAverageVenueDto = {
  locationId: string | null
  locationName: string
  currentRevenue: number
  average: RevenueAverageCompareSlice | null
  yearAgo: RevenueAverageCompareSlice | null
}

export type DailyOpsRevenueAveragesDto = {
  period: string
  kind: RevenueAverageKind
  /** Combined (3 venues) */
  combined: RevenueAverageVenueDto
  byVenue: RevenueAverageVenueDto[]
}
