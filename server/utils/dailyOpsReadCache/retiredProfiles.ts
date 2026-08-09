/**
 * @registry-id: dailyOpsReadCacheRetiredProfiles
 * @created: 2026-08-09T00:30:00.000Z
 * @last-modified: 2026-08-09T00:30:00.000Z
 * @description: Retirement status of daily_ops_read_cache profiles (PERIOD_CACHE_ADR Phase 7)
 * @last-fix: [2026-08-09] Mark reserved profiles retired; dashboard-bundle + weekly-digest still active
 * @adr-ref: PERIOD_CACHE_ADR L2
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsReadCache/types.ts
 */

import type { DailyOpsReadCacheProfile } from './types'

/**
 * Profiles that were ADR-013 reserved slots and never became write SSOT.
 * Readers must use period-cache / snapshots instead — do not add new writers.
 */
export const RETIRED_READ_CACHE_PROFILES: readonly DailyOpsReadCacheProfile[] = [
  'revenue-categories',
  'revenue-products',
  'revenue-summary',
  'revenue-timeseries',
  'revenue-rolling-medians',
  'staff-timeseries',
  'staff-plusmin',
] as const

/**
 * Still written for legacy UI until dedicated period-cache GET cutover.
 * Not authoritative for BE / food-bev / ratios (those = PERIOD_CACHE_ADR).
 */
export const LEGACY_ACTIVE_READ_CACHE_PROFILES: readonly DailyOpsReadCacheProfile[] = [
  'dashboard-bundle',
  'weekly-digest',
] as const

export function isRetiredReadCacheProfile (profile: string): boolean {
  return (RETIRED_READ_CACHE_PROFILES as readonly string[]).includes(profile)
}
