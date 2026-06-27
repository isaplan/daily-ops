/**
 * @registry-id: revenueDailyBenchmarkTypes
 * @created: 2026-06-24T00:00:00.000Z
 * @last-modified: 2026-06-24T00:00:00.000Z
 * @description: Datalab/register daily revenue benchmarks (pre–Bork-agg history)
 * @last-fix: [2026-06-24] Initial — 2024 full-year Datalab export seed
 *
 * @exports-to:
 * ✓ server/utils/revenueDailyBenchmarkService.ts
 * ✓ server/utils/dailyOpsSnapshot/buildRevenueSection.ts
 */

export type RevenueDailyBenchmarkSource = 'datalab_export'

/** One venue × business_date row in Mongo `revenue_daily_benchmark`. */
export type RevenueDailyBenchmarkDoc = {
  businessDate: string
  locationId: string
  locationName: string
  ex_vat: number
  inc_vat: number
  vat: number
  quantity: number
  source: RevenueDailyBenchmarkSource
  /** Repo-relative path of the import file. */
  sourceFile: string
  updatedAt: Date
}
