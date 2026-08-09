/**
 * @registry-id: dailyOpsLoadDashboardBundleForGet
 * @created: 2026-08-09T00:30:00.000Z
 * @last-modified: 2026-08-09T00:30:00.000Z
 * @description: GET-only dashboard-bundle loader — read-cache first, gap on miss (no live assemble)
 * @last-fix: [2026-08-09] Shared cache-first path for summary/labor/revenue-breakdown/overview/bundle
 * @adr-ref: ADR-004, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=dashboard-bundle
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 * ✓ server/api/daily-ops/metrics/summary.get.ts
 * ✓ server/api/daily-ops/metrics/labor.get.ts
 * ✓ server/api/daily-ops/metrics/revenue-breakdown.get.ts
 * ✓ server/api/daily-ops/overview.get.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { loadCachedDashboardBundle } from './cacheCascade'
import { emptyDashboardBundleForCacheMiss } from './emptyDashboardBundleForCacheMiss'
import { withResolvedTableOccupancy } from './ensureBundleTableOccupancy'
import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'

/** Cache-first GET path. Never calls fetchDailyOpsDashboardBundle. */
export async function loadDashboardBundleForGet (
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsDashboardBundleDto> {
  const cached = await loadCachedDashboardBundle(db, ctx)
  if (cached) {
    return withResolvedTableOccupancy(db, ctx, cached)
  }
  return withResolvedTableOccupancy(db, ctx, emptyDashboardBundleForCacheMiss(ctx))
}
