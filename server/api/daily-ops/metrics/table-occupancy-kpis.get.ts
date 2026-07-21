/**
 * @registry-id: dailyOpsTableOccupancyKpisGet
 * @created: 2026-07-17T18:05:00.000Z
 * @last-modified: 2026-07-17T18:05:00.000Z
 * @description: GET /api/daily-ops/metrics/table-occupancy-kpis — active tables + bezettingsgraad
 * @last-fix: [2026-07-17] Lazy KPI from snapshot tables + venue catalog
 * @adr-ref: ADR-004, ADR-013
 * @data-source: snapshot + catalog
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 */

import { getDb } from '../../../utils/db'
import { parseDailyOpsMetricsQuery } from '../../../utils/dailyOpsMetrics/context'
import { fetchDailyOpsTableOccupancyKpis } from '../../../utils/dailyOpsVenueTables/fetchTableOccupancyKpis'
import type { DailyOpsTableOccupancyKpisDto } from '~/types/daily-ops-venue-tables'

export default defineEventHandler(async (event): Promise<DailyOpsTableOccupancyKpisDto> => {
  const ctx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const db = await getDb()
  return fetchDailyOpsTableOccupancyKpis(db, ctx)
})
