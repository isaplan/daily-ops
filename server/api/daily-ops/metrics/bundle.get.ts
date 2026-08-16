/**
 * @registry-id: dailyOpsMetricsBundle
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-08-16T15:55:00.000Z
 * @description: Dashboard metrics bundle — Today live; sealed days period-cache
 * @last-fix: [2026-08-16] Return cacheVersion for client freshness
 *   Prior: [2026-08-09] Today live exception via loadDashboardBundleForGet
 * @adr-ref: ADR-004, ADR-010, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: snapshot-today-live | period-cache
 * @read-cache-json: daily_ops_period_cache · level=day (sealed)
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
  const cached = await loadDashboardBundleForGet(db, ctx) as Awaited<
    ReturnType<typeof loadDashboardBundleForGet>
  > & { cacheVersion?: string | null }
  return {
    summary: cached.summary,
    revenue: cached.revenue,
    labor: cached.labor,
    periodBreakdown: cached.periodBreakdown,
    tableOccupancy: cached.tableOccupancy,
    cacheVersion: cached.cacheVersion ?? null,
  }
})
