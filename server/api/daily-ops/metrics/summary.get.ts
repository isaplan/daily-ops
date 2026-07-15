/**
 * @registry-id: dailyOpsMetricsSummary
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=dashboard-bundle · levels=daily|weekly|monthly|yearly
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import {
  fetchDailyOpsDashboardBundle,
} from '../../../utils/dailyOpsSnapshot/fetchDashboardBundle'
import { snapshotCacheControl } from '../../../utils/dailyOpsSnapshot/dashboardBundle/snapshotCacheControl'

export default defineEventHandler(async (event) => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))
  const db = await getDb()
  const { summary } = await fetchDailyOpsDashboardBundle(db, ctx)
  return summary
})
