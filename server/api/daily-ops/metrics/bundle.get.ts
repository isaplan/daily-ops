/**
 * @registry-id: dailyOpsMetricsBundle
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-07-22T12:00:00.000Z
 * @description: Dashboard metrics bundle — read daily_ops_read_cache only (ADR-013)
 * @last-fix: [2026-07-22] Backfill missing tableOccupancy from sealed snapshots on GET
 *   Prior: [2026-07-22] Return sealed tableOccupancy from cache (no strip)
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=dashboard-bundle · levels=daily|weekly|monthly|yearly
 *
 * @exports-to:
 * ✓ composables/useDailyOpsDashboardMetrics.ts
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { snapshotCacheControl } from '../../../utils/dailyOpsSnapshot/dashboardBundle/snapshotCacheControl'
import { loadCachedDashboardBundle } from '../../../utils/dailyOpsSnapshot/cacheCascade'
import { bundleDashboardSectionsIncomplete } from '../../../utils/dailyOpsSnapshot/bundleInvariant'
import { emptyDashboardBundleForCacheMiss } from '../../../utils/dailyOpsSnapshot/emptyDashboardBundleForCacheMiss'
import { withResolvedTableOccupancy } from '../../../utils/dailyOpsSnapshot/ensureBundleTableOccupancy'

function bundlePayload(cached: Awaited<ReturnType<typeof withResolvedTableOccupancy>>) {
  return {
    summary: cached.summary,
    revenue: cached.revenue,
    labor: cached.labor,
    periodBreakdown: cached.periodBreakdown,
    tableOccupancy: cached.tableOccupancy,
  }
}

export default defineEventHandler(async (event) => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))

  const db = await getDb()
  const cached = await loadCachedDashboardBundle(db, ctx)

  if (cached && !bundleDashboardSectionsIncomplete(cached)) {
    return bundlePayload(await withResolvedTableOccupancy(db, ctx, cached))
  }

  if (cached) {
    return bundlePayload(await withResolvedTableOccupancy(db, ctx, cached))
  }

  const gap = emptyDashboardBundleForCacheMiss(ctx)
  return {
    summary: gap.summary,
    revenue: gap.revenue,
    labor: gap.labor,
    periodBreakdown: gap.periodBreakdown,
    tableOccupancy: await withResolvedTableOccupancy(db, ctx, gap).then((b) => b.tableOccupancy),
  }
})
