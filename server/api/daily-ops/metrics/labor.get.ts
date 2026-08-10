/**
 * @registry-id: dailyOpsMetricsLabor
 * @last-modified: 2026-08-09T17:25:00.000Z
 * @last-fix: [2026-08-09] Today live exception via loadDashboardBundleForGet
 * @adr-ref: ADR-004, ADR-010, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: snapshot-today-live | period-cache
 * @read-cache-json: daily_ops_period_cache · level=day (sealed)
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { snapshotCacheControl } from '../../../utils/dailyOpsSnapshot/dashboardBundle/snapshotCacheControl'
import { loadDashboardBundleForGet } from '../../../utils/dailyOpsSnapshot/loadDashboardBundleForGet'

export default defineEventHandler(async (event) => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))
  const db = await getDb()
  const { labor } = await loadDashboardBundleForGet(db, ctx)
  return labor
})
