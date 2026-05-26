/**
 * @registry-id: dailyOpsMetricsRevenueBreakdown
 * @last-modified: 2026-05-25T00:00:00.000Z
 * @last-fix: [2026-05-25] Delegates to snapshot bundle (ADR-004).
 * @adr-ref: ADR-004
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsDashboardMetrics'
import {
  fetchDailyOpsDashboardBundle,
  snapshotCacheControl,
} from '../../../utils/dailyOpsSnapshot/fetchDashboardBundle'

export default defineEventHandler(async (event) => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))
  const db = await getDb()
  const { revenue } = await fetchDailyOpsDashboardBundle(db, ctx)
  return revenue
})
