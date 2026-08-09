/**
 * @registry-id: dailyOpsLoadDashboardBundleForGet
 * @created: 2026-08-09T00:30:00.000Z
 * @last-modified: 2026-08-09T17:30:00.000Z
 * @description: GET-only dashboard-bundle loader — period-cache projection (Phase 7)
 * @last-fix: [2026-08-09] Phase 7 — assemble from period-cache; no dashboard-bundle read-cache
 * @adr-ref: ADR-004, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache · level=day
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 * ✓ server/api/daily-ops/metrics/summary.get.ts
 * ✓ server/api/daily-ops/metrics/labor.get.ts
 * ✓ server/api/daily-ops/metrics/revenue-breakdown.get.ts
 * ✓ server/api/daily-ops/overview.get.ts
 * ✓ server/api/daily-ops/metrics/venue-strip.get.ts
 * ✓ server/api/daily-ops/metrics/table-occupancy-kpis.get.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { assembleDashboardBundleFromPeriodCache } from '../dailyOpsPeriodCache/assembleDashboardBundleFromPeriodCache'
import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'

/** Period-cache GET path. Never calls fetchDailyOpsDashboardBundle or read-cache. */
export async function loadDashboardBundleForGet (
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsDashboardBundleDto> {
  return assembleDashboardBundleFromPeriodCache(db, ctx)
}
