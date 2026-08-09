/**
 * @registry-id: dailyOpsReadCacheRetiredProfiles
 * @created: 2026-08-09T00:30:00.000Z
 * @last-modified: 2026-08-09T15:50:00.000Z
 * @description: Retirement status of daily_ops_read_cache profiles (PERIOD_CACHE_ADR Phase 7)
 * @last-fix: [2026-08-09] Document residual: dashboard-bundle + weekly-digest = prebuilt GET only
 * @adr-ref: PERIOD_CACHE_ADR L2
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsReadCache/types.ts
 */

import type { DailyOpsReadCacheProfile } from './types'

/**
 * Profiles that were ADR-013 reserved slots and never became write SSOT.
 * Readers must use period-cache instead — do not add new writers.
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
 * Still written at snapshot/digest seal time; GET reads these JSON blobs only
 * (never live-assemble). Full delete deferred until dashboard + weekly report
 * DTOs are rebuilt purely from `daily_ops_period_cache` nodes.
 */
export const LEGACY_ACTIVE_READ_CACHE_PROFILES: readonly DailyOpsReadCacheProfile[] = [
  'dashboard-bundle',
  'weekly-digest',
] as const

export function isRetiredReadCacheProfile (profile: string): boolean {
  return (RETIRED_READ_CACHE_PROFILES as readonly string[]).includes(profile)
}
