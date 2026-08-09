/**
 * @registry-id: dailyOpsTableOccupancyKpisGet
 * @created: 2026-07-17T18:05:00.000Z
 * @last-modified: 2026-08-09T17:30:00.000Z
 * @description: GET table-occupancy-kpis — period-cache projection (Phase 7)
 * @last-fix: [2026-08-09] Phase 7 — from assembleDashboardBundleFromPeriodCache
 * @adr-ref: ADR-004, ADR-013, PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache · level=day
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { loadDashboardBundleForGet } from '../../../utils/dailyOpsSnapshot/loadDashboardBundleForGet'
import { snapshotCacheControl } from '../../../utils/dailyOpsSnapshot/dashboardBundle/snapshotCacheControl'
import type { DailyOpsTableOccupancyKpisDto } from '~/types/daily-ops-venue-tables'

export default defineEventHandler(async (event): Promise<DailyOpsTableOccupancyKpisDto> => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', snapshotCacheControl(ctx))

  const db = await getDb()
  const bundle = await loadDashboardBundleForGet(db, ctx)
  if (bundle.tableOccupancy) return bundle.tableOccupancy

  return {
    range: { period: ctx.period, startDate: ctx.startDate, endDate: ctx.endDate },
    activeTables: 0,
    totalTables: 0,
    occupancyPct: null,
    venues: [],
    aggregation: 'day',
  }
})
