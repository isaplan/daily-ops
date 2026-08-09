/**
 * @registry-id: dailyOpsReadCacheRetiredProfiles
 * @created: 2026-08-09T00:30:00.000Z
 * @last-modified: 2026-08-09T17:30:00.000Z
 * @description: Retirement status of daily_ops_read_cache profiles (PERIOD_CACHE_ADR Phase 7)
 * @last-fix: [2026-08-09] Phase 7 complete — dashboard-bundle + weekly-digest retired
 * @adr-ref: PERIOD_CACHE_ADR L2
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsReadCache/types.ts
 */

import type { DailyOpsReadCacheProfile } from './types'

/**
 * All former ADR-013 read-cache profiles — GET uses period-cache projection.
 * Do not add new writers for these names.
 */
export const RETIRED_READ_CACHE_PROFILES: readonly DailyOpsReadCacheProfile[] = [
  'revenue-categories',
  'revenue-products',
  'revenue-summary',
  'revenue-timeseries',
  'revenue-rolling-medians',
  'staff-timeseries',
  'staff-plusmin',
  'dashboard-bundle',
  'weekly-digest',
] as const

/** Empty — Phase 7 complete; no legacy-active read-cache profiles. */
export const LEGACY_ACTIVE_READ_CACHE_PROFILES: readonly DailyOpsReadCacheProfile[] = [] as const

export function isRetiredReadCacheProfile (profile: string): boolean {
  return (RETIRED_READ_CACHE_PROFILES as readonly string[]).includes(profile)
}
