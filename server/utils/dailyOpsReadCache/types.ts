/**
 * @registry-id: dailyOpsReadCacheTypes
 * @created: 2026-07-02T00:00:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Types for daily_ops_read_cache Mongo collection (ADR-013)
 * @last-fix: [2026-07-02] Initial read-cache document types
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @write-cache-json: daily_ops_read_cache · all profiles
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsReadCache/readCacheStore.ts
 */

export type DailyOpsReadCacheLevel = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type DailyOpsReadCacheProfile =
  | 'dashboard-bundle'
  | 'staff-timeseries'
  | 'staff-plusmin'
  | 'revenue-summary'
  | 'revenue-timeseries'
  | 'revenue-categories'
  | 'revenue-products'
  | 'revenue-rolling-medians'
  | 'weekly-digest'

export type DailyOpsReadCacheKey = {
  profile: DailyOpsReadCacheProfile | string
  level: DailyOpsReadCacheLevel
  key: string
  locationId: string
}

export type DailyOpsReadCacheDoc<T = unknown> = DailyOpsReadCacheKey & {
  businessDateStart?: string
  businessDateEnd?: string
  payload: T
  lastBuiltAt: Date
}
