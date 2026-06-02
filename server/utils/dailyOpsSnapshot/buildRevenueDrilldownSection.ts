/**
 * @registry-id: dailyOpsSnapshotBuildRevenueDrilldownSection
 * @created: 2026-05-26T02:36:00.000Z
 * @last-modified: 2026-06-02T23:30:00.000Z
 * @description: Orchestrates snapshot-backed Daily Ops revenue drilldown DTO
 * @last-fix: [2026-06-02] Name-aware catalog resolver for food/beverage top-10 split
 *   Prior: [2026-06-02] Top-10 food/beverage split uses product_catalog SSOT
 *   Prior: [2026-05-28] Coverage note when order-time worker snapshots are missing
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsRevenueDrilldownDto } from '~/types/daily-ops-dashboard'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { formatProfitEstimatesNote } from '../dailyOpsMetrics/profitHour'
import { DEFAULT_PNL_ASSUMPTIONS } from '~/utils/dailyOpsPnlAssumptionsDefaults'
import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'
import { loadProductCatalogResolver } from '../borkFoodBeverageSplit'
import { buildHourlyRows } from './drilldown/buildRevenueDrilldownHourly'
import { loadHourlyBenchmarks } from './drilldown/hourlyBenchmarks'
import { buildRevenueDrilldownSpaces } from './drilldown/buildRevenueDrilldownSpaces'
import { buildRevenueDrilldownTop10 } from './drilldown/buildRevenueDrilldownTop10'
import type { BuildRevenueDrilldownInput } from './drilldown/drilldownShared'

export async function buildRevenueDrilldownSection(
  db: Db,
  ctx: DailyOpsMetricsContext,
  input: BuildRevenueDrilldownInput,
  pnlAssumptions?: DailyOpsSimplePnLAssumptions,
): Promise<DailyOpsRevenueDrilldownDto> {
  const hourlyBenchmarks = await loadHourlyBenchmarks(db, ctx)
  const catalogResolver = await loadProductCatalogResolver(db, {
    salesRange: { range_start: ctx.startDate, range_end: ctx.endDate },
  })
  const hourlyRows = buildHourlyRows(ctx, input, hourlyBenchmarks, pnlAssumptions)
  const spaces = buildRevenueDrilldownSpaces(input)
  const top10 = buildRevenueDrilldownTop10(input, catalogResolver)
  const coverageNotes: string[] = []
  const activeRevenueHourCount = hourlyRows.filter((row) => row.revenue > 0).length
  const benchmarkedActiveHourCount = hourlyRows.filter(
    (row) => row.revenue > 0 && row.benchmarkRevenue != null,
  ).length

  if (input.hourly.length === 0) coverageNotes.push('No hourly revenue snapshot rows for this range.')
  if (hourlyBenchmarks.size === 0) {
    coverageNotes.push(
      ctx.startDate !== ctx.endDate
        ? 'No hourly benchmark for this period — need revenue_hourly snapshots for prior same weekdays.'
        : 'No last-5 same-weekday hourly benchmark available yet.',
    )
  }
  else if (benchmarkedActiveHourCount < activeRevenueHourCount) {
    coverageNotes.push(
      `Hourly benchmark covers ${benchmarkedActiveHourCount} of ${activeRevenueHourCount} active revenue hours.`,
    )
  }
  if (input.tables.length === 0) coverageNotes.push('No table/space revenue snapshot rows for this range.')
  if (input.workers.length === 0) coverageNotes.push('No worker revenue snapshot rows for this range.')
  else if (input.workers.every((doc) => (doc.orderTimeWorkers?.length ?? 0) === 0)) {
    coverageNotes.push('Order-time worker rankings unavailable — rebuild snapshots after Bork order-worker aggregation.')
  }
  if (input.products.length === 0) coverageNotes.push('No product/category revenue snapshot rows for this range.')

  return {
    estimatesNote: formatProfitEstimatesNote(pnlAssumptions ?? DEFAULT_PNL_ASSUMPTIONS),
    multiDayRange: ctx.startDate !== ctx.endDate,
    coverageNotes,
    hourlyRows,
    spaces,
    top10,
  }
}
