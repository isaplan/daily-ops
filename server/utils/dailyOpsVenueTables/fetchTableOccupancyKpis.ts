/**
 * @registry-id: dailyOpsTableOccupancyKpis
 * @created: 2026-07-17T18:05:00.000Z
 * @last-modified: 2026-07-20T00:00:00.000Z
 * @description: Active tables + bezettingsgraad from snapshot tables + learned catalog
 * @last-fix: [2026-07-20] Delegate to avg-daily summary builder for multi-day periods
 * @adr-ref: ADR-004, ADR-013
 * @data-source: snapshot + catalog
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/table-occupancy-kpis.get.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsTableOccupancyKpisDto } from '../../../types/daily-ops-venue-tables'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { buildTableOccupancySummary } from './buildTableOccupancySummary'

export async function fetchDailyOpsTableOccupancyKpis(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsTableOccupancyKpisDto> {
  return buildTableOccupancySummary(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId,
    period: ctx.period,
  })
}
