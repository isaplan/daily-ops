/**
 * @registry-id: dailyOpsEnsureBundleTableOccupancy
 * @created: 2026-07-22T12:00:00.000Z
 * @last-modified: 2026-07-22T12:00:00.000Z
 * @description: Fill missing tableOccupancy from sealed snapshot tables (not live Bork)
 * @last-fix: [2026-07-22] Backfill occupancy when dashboard-bundle cache predates series seal
 * @adr-ref: ADR-004, ADR-013
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
import { buildHourOccupancySeriesFromRevenue } from '../dailyOpsVenueTables/buildOccupancySeries'
import type { DailyOpsDashboardBundleDto } from './fetchDashboardBundle'

/** Snapshot-backed occupancy when cache JSON lacks tableOccupancy (pre-seal docs). */
export async function resolveTableOccupancyForContext(
  db: Db,
  ctx: DailyOpsMetricsContext,
  bundle?: DailyOpsDashboardBundleDto | null,
): Promise<DailyOpsTableOccupancyKpisDto> {
  if (bundle?.tableOccupancy) {
    const occ = bundle.tableOccupancy
    if (
      ctx.startDate === ctx.endDate
      && (!occ.series?.hour?.length)
      && bundle.revenue?.drilldown?.hourlyRows?.length
      && occ.series
    ) {
      return {
        ...occ,
        series: {
          ...occ.series,
          hour: buildHourOccupancySeriesFromRevenue(
            occ.activeTables,
            occ.totalTables,
            occ.occupancyPct,
            bundle.revenue.drilldown.hourlyRows,
          ),
        },
      }
    }
    return occ
  }

  const built = await buildTableOccupancySummary(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId,
    period: ctx.period,
  })

  const hourlyRows = bundle?.revenue?.drilldown?.hourlyRows
  if (
    ctx.startDate === ctx.endDate
    && hourlyRows?.length
    && built.series
  ) {
    return {
      ...built,
      series: {
        ...built.series,
        hour: buildHourOccupancySeriesFromRevenue(
          built.activeTables,
          built.totalTables,
          built.occupancyPct,
          hourlyRows,
        ),
      },
    }
  }

  return built
}

export async function withResolvedTableOccupancy(
  db: Db,
  ctx: DailyOpsMetricsContext,
  bundle: DailyOpsDashboardBundleDto,
): Promise<DailyOpsDashboardBundleDto> {
  if (bundle.tableOccupancy?.series && (ctx.startDate !== ctx.endDate || bundle.tableOccupancy.series.hour?.length)) {
    return bundle
  }
  const tableOccupancy = await resolveTableOccupancyForContext(db, ctx, bundle)
  return { ...bundle, tableOccupancy }
}
