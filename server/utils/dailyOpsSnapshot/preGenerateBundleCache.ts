/**
 * @registry-id: dailyOpsPreGenerateBundleCache
 * @created: 2026-06-05T17:50:00.000Z
 * @last-modified: 2026-08-09T17:30:00.000Z
 * @description: Phase 7 no-op — dashboard-bundle retired; period-cache is GET SSOT
 * @last-fix: [2026-08-09] Phase 7 — stop writing dashboard-bundle read-cache
 * @adr-ref: PERIOD_CACHE_ADR L2
 * @data-source: none
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 * ✓ server/plugins/bundle-cache-catchup.ts
 */

import type { Db } from 'mongodb'
import { cascadePeriodRange } from '../dailyOpsPeriodCache/cascadePeriod'

/** Phase 7: no-op (period-cache sealed earlier in snapshot hook). */
export async function preGenerateBundleForDate (
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<{ written: boolean; path: string | null; error?: string }> {
  void db
  void businessDate
  void locationId
  return { written: false, path: null }
}

/** Phase 7: ensure period-cache cascade for range (no dashboard-bundle writes). */
export async function preGenerateBundlesForRange (
  db: Db,
  startDate: string,
  endDate: string,
  locationIds: string[],
): Promise<{ generated: number; errors: number }> {
  void locationIds
  try {
    await cascadePeriodRange(db, startDate, endDate)
    return { generated: 0, errors: 0 }
  } catch {
    return { generated: 0, errors: 1 }
  }
}

/** Phase 7: period-cache cascade only. */
export async function refreshDashboardBundleCache (
  db: Db,
  startDate: string,
  endDate: string,
  locationIds: string[],
): Promise<{ daily: { generated: number; errors: number }; cascade: { weekly: number; monthly: number; yearly: number } }> {
  void locationIds
  await cascadePeriodRange(db, startDate, endDate)
  return {
    daily: { generated: 0, errors: 0 },
    cascade: { weekly: 0, monthly: 0, yearly: 0 },
  }
}
