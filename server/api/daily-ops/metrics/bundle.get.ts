/**
 * @registry-id: dailyOpsMetricsBundle
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-06-10T00:00:00.000Z
 * @description: Single dashboard metrics bundle — snapshot read only (ADR-004). Serves pre-generated JSON for sealed days.
 * @last-fix: [2026-06-10] Smart cache compose for YTD/year; cap partial periods via period resolver
 *   Prior: [2026-06-05] Check pre-generated bundle cache first (instant page loads)
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
import { loadCachedDashboardBundle } from '../../../utils/dailyOpsSnapshot/cacheCascade'

export default defineEventHandler(async (event) => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))

  const cached = await loadCachedDashboardBundle(ctx)
  if (cached) {
    console.info(
      `[bundle:cache] HIT [composed] ${ctx.startDate}..${ctx.endDate} ${ctx.locationId ?? 'all'}`,
    )
    return {
      summary: cached.summary,
      revenue: cached.revenue,
      labor: cached.labor,
    }
  }

  const db = await getDb()
  const bundle = await fetchDailyOpsDashboardBundle(db, ctx)
  return {
    summary: bundle.summary,
    revenue: bundle.revenue,
    labor: bundle.labor,
  }
})
