/**
 * @registry-id: dailyOpsTableOccupancyKpisGet
 * @created: 2026-07-17T18:05:00.000Z
 * @last-modified: 2026-07-22T00:00:00.000Z
 * @description: GET table-occupancy-kpis — dashboard-bundle cache only (ADR-013)
 * @last-fix: [2026-07-22] Stop live snapshot aggregation; read sealed bundle.tableOccupancy
 *   Prior: [2026-07-17] Lazy KPI from snapshot tables + venue catalog
 * @adr-ref: ADR-004, ADR-013
 * @data-source: read-cache
 * @read-cache-json: daily_ops_read_cache · profile=dashboard-bundle · levels=daily|weekly|monthly|yearly
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { loadCachedDashboardBundle } from '../../../utils/dailyOpsSnapshot/cacheCascade'
import { snapshotCacheControl } from '../../../utils/dailyOpsSnapshot/dashboardBundle/snapshotCacheControl'
import type { DailyOpsTableOccupancyKpisDto } from '~/types/daily-ops-venue-tables'

export default defineEventHandler(async (event): Promise<DailyOpsTableOccupancyKpisDto> => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))

  const db = await getDb()
  const cached = await loadCachedDashboardBundle(db, ctx)
  if (cached?.tableOccupancy) return cached.tableOccupancy

  return {
    range: { period: ctx.period, startDate: ctx.startDate, endDate: ctx.endDate },
    activeTables: 0,
    totalTables: 0,
    occupancyPct: null,
    venues: [],
    aggregation: ctx.startDate === ctx.endDate ? 'day' : 'avg_daily',
  }
})
