/**
 * @registry-id: dailyOpsMetricsBundle
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-08-09T17:55:00.000Z
 * @description: Dashboard metrics bundle — period-cache projection (Phase 7)
 * @last-fix: [2026-08-09] Phase 7 — assembleDashboardBundleFromPeriodCache via loader
 *   Prior: [2026-08-09] Shared loadDashboardBundleForGet (cache-first, gap on miss)
 * @adr-ref: ADR-004, ADR-010, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache · level=day
 *
 * @exports-to:
 * ✓ composables/useDailyOpsDashboardMetrics.ts
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { snapshotCacheControl } from '../../../utils/dailyOpsSnapshot/dashboardBundle/snapshotCacheControl'
import { loadDashboardBundleForGet } from '../../../utils/dailyOpsSnapshot/loadDashboardBundleForGet'

export default defineEventHandler(async (event) => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))

  const db = await getDb()
  const cached = await loadDashboardBundleForGet(db, ctx)
  return {
    summary: cached.summary,
    revenue: cached.revenue,
    labor: cached.labor,
    periodBreakdown: cached.periodBreakdown,
    tableOccupancy: cached.tableOccupancy,
  }
})
