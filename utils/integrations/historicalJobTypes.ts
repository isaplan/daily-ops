/**
 * @registry-id: integrationHistoricalJobTypes
 * @created: 2026-06-24T00:00:00.000Z
 * @last-modified: 2026-06-24T00:00:00.000Z
 * @description: Bork/Eitje historical job type ids + lookback day counts (7d daily, 31d monthly)
 * @last-fix: [2026-06-24] Split historical-data into 7d daily and 31d monthly windows
 *
 * @exports-to:
 * ✓ server/services/borkSyncService.ts
 * ✓ server/services/eitjeSyncService.ts
 * ✓ server/tasks/integrations/*
 */

export const INTEGRATION_HISTORICAL_JOB_TYPES = [
  'historical-data',
  'historical-data-7d',
  'historical-data-31d',
] as const

export type IntegrationHistoricalJobType = (typeof INTEGRATION_HISTORICAL_JOB_TYPES)[number]

const HISTORICAL_SET = new Set<string>(INTEGRATION_HISTORICAL_JOB_TYPES)

/** Daily rolling lookback (excludes today). */
export const INTEGRATION_HISTORICAL_DAYS_7 = 7

/** Monthly deep lookback (excludes today). */
export const INTEGRATION_HISTORICAL_DAYS_31 = 31

export function isIntegrationHistoricalJobType(jobType: string): boolean {
  return HISTORICAL_SET.has(jobType)
}

/** Resolve lookback days for historical-* job types; null when not a historical job. */
export function historicalLookbackDaysForJobType(jobType: string): number | null {
  if (jobType === 'historical-data-31d') return INTEGRATION_HISTORICAL_DAYS_31
  if (jobType === 'historical-data' || jobType === 'historical-data-7d') {
    return INTEGRATION_HISTORICAL_DAYS_7
  }
  return null
}
