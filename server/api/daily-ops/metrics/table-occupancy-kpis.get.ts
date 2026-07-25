/**
 * @registry-id: dailyOpsTableOccupancyKpisGet
 * @created: 2026-07-17T18:05:00.000Z
 * @last-modified: 2026-07-22T12:00:00.000Z
 * @description: GET table-occupancy-kpis — sealed bundle or snapshot backfill
 * @last-fix: [2026-07-22] Backfill from snapshot tables when bundle lacks tableOccupancy
 *   Prior: [2026-07-22] Stop live snapshot aggregation; read sealed bundle.tableOccupancy
 * @adr-ref: ADR-004, ADR-013
 * @data-source: mixed
 * @read-cache-json: daily_ops_read_cache · profile=dashboard-bundle · + snapshot tables backfill
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { loadCachedDashboardBundle } from '../../../utils/dailyOpsSnapshot/cacheCascade'
import { snapshotCacheControl } from '../../../utils/dailyOpsSnapshot/dashboardBundle/snapshotCacheControl'
import { resolveTableOccupancyForContext } from '../../../utils/dailyOpsSnapshot/ensureBundleTableOccupancy'
import type { DailyOpsTableOccupancyKpisDto } from '~/types/daily-ops-venue-tables'

export default defineEventHandler(async (event): Promise<DailyOpsTableOccupancyKpisDto> => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))

  const db = await getDb()
  const cached = await loadCachedDashboardBundle(db, ctx)
  return resolveTableOccupancyForContext(db, ctx, cached)
})
