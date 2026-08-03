/**
 * @registry-id: dailyOpsEnsureBundleTableOccupancy
 * @created: 2026-07-22T12:00:00.000Z
 * @last-modified: 2026-07-29T22:10:00.000Z
 * @description: Fill missing tableOccupancy from sealed snapshot tables (not live Bork)
 * @last-fix: [2026-07-29] Drop revenue-share hour proxy; use sealed tablesByHour only
 *   Prior: [2026-07-22] Backfill occupancy when dashboard-bundle cache predates series seal
 * @adr-ref: ADR-004, ADR-013, ADR-017
 * @data-source: snapshot-write-only
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 * ✓ server/api/daily-ops/metrics/table-occupancy-kpis.get.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import type { DailyOpsTableOccupancyKpisDto } from '~/types/daily-ops-venue-tables'
import { buildTableOccupancySummary } from '../dailyOpsVenueTables/buildTableOccupancySummary'
import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'

/** Snapshot-backed occupancy when cache JSON lacks tableOccupancy (pre-seal docs). */
export async function resolveTableOccupancyForContext(
  db: Db,
  ctx: DailyOpsMetricsContext,
  bundle?: DailyOpsDashboardBundleDto | null,
): Promise<DailyOpsTableOccupancyKpisDto> {
  if (bundle?.tableOccupancy) {
    const occ = bundle.tableOccupancy
    const needsHour =
      ctx.startDate === ctx.endDate
      && !(occ.hourly?.length)
      && !(occ.series?.hour?.length)
    if (!needsHour) return occ
  }

  return buildTableOccupancySummary(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId,
    period: ctx.period,
  })
}

export async function withResolvedTableOccupancy(
  db: Db,
  ctx: DailyOpsMetricsContext,
  bundle: DailyOpsDashboardBundleDto,
): Promise<DailyOpsDashboardBundleDto> {
  const occ = bundle.tableOccupancy
  if (
    occ?.series
    && (ctx.startDate !== ctx.endDate || occ.hourly?.length || occ.series.hour?.length)
  ) {
    return bundle
  }
  const tableOccupancy = await resolveTableOccupancyForContext(db, ctx, bundle)
  return { ...bundle, tableOccupancy }
}
