/**
 * @registry-id: dailyOpsMetricsBundle
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-05-25T00:00:00.000Z
 * @description: Single dashboard metrics bundle — snapshot read only (ADR-004).
 * @last-fix: [2026-05-25] Replaced live Bork/Eitje aggregation with fetchDailyOpsDashboardBundle.
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ composables/useDailyOpsDashboardMetrics.ts
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import {
  fetchDailyOpsDashboardBundle,
  snapshotCacheControl,
} from '../../../utils/dailyOpsSnapshot/fetchDashboardBundle'

export default defineEventHandler(async (event) => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))
  const db = await getDb()
  const bundle = await fetchDailyOpsDashboardBundle(db, ctx)
  return {
    summary: bundle.summary,
    revenue: bundle.revenue,
    labor: bundle.labor,
  }
})
