/**
 * @registry-id: dailyOpsReadCacheTypes
 * @created: 2026-07-02T00:00:00.000Z
 * @last-modified: 2026-08-09T00:30:00.000Z
 * @description: Types for daily_ops_read_cache Mongo collection (legacy)
 * @last-fix: [2026-08-09] Phase 7: most profiles retired; see retiredProfiles.ts + PERIOD_CACHE_ADR
 * @adr-ref: PERIOD_CACHE_ADR L2
 * @data-source: read-cache
 * @write-cache-json: daily_ops_read_cache · dashboard-bundle + weekly-digest only
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsReadCache/readCacheStore.ts
 * ✓ server/utils/dailyOpsReadCache/retiredProfiles.ts
 */

export type DailyOpsReadCacheLevel = 'daily' | 'weekly' | 'monthly' | 'yearly'

/**
 * Legacy profile names. Prefer PERIOD_CACHE_ADR / daily_ops_period_cache.
 * Active writers: dashboard-bundle, weekly-digest only (see retiredProfiles.ts).
 */
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
