/**
 * @registry-id: dailyOpsTeamBucket
 * @created: 2026-05-16T23:30:00.000Z
 * @last-modified: 2026-05-16T23:30:00.000Z
 * @description: Maps Eitje team names to Keuken / Bediening / Other buckets for dashboard rollups.
 * @last-fix: [2026-05-16] Initial.
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsVenueStrip.ts
 */

export type TeamBucket = 'keuken' | 'bediening' | 'other'

export function bucketTeamFromName(name: string): TeamBucket {
  const n = (name ?? '').trim().toLowerCase()
  if (n === 'keuken') return 'keuken'
  if (n === 'bediening') return 'bediening'
  return 'other'
}
