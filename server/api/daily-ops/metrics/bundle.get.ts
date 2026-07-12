/**
 * @registry-id: dailyOpsMetricsBundle
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Dashboard metrics bundle — read daily_ops_read_cache only (ADR-013)
 * @last-fix: [2026-07-02] Mongo read-cache lookup before live snapshot fallback
 *   Prior: [2026-06-20] Reject stale cache when drilldown or profit-by-interval missing
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=dashboard-bundle · levels=daily|weekly|monthly|yearly
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
import { bundleDashboardSectionsIncomplete } from '../../../utils/dailyOpsSnapshot/bundleInvariant'

export default defineEventHandler(async (event) => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))

  const db = await getDb()
  const cached = await loadCachedDashboardBundle(db, ctx)
  if (cached && !bundleDashboardSectionsIncomplete(cached)) {
    console.info(
      `[bundle:cache] HIT [composed] ${ctx.startDate}..${ctx.endDate} ${ctx.locationId ?? 'all'}`,
    )
    return {
      summary: cached.summary,
      revenue: cached.revenue,
      labor: cached.labor,
      periodBreakdown: cached.periodBreakdown,
    }
  }
  if (cached && bundleDashboardSectionsIncomplete(cached)) {
    console.warn(
      `[bundle:cache] STALE sections ${ctx.startDate}..${ctx.endDate} ${ctx.locationId ?? 'all'} — live rebuild`,
    )
  }

  const bundle = await fetchDailyOpsDashboardBundle(db, ctx)
  return {
    summary: bundle.summary,
    revenue: bundle.revenue,
    labor: bundle.labor,
    periodBreakdown: bundle.periodBreakdown,
  }
})
