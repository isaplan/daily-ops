/**
 * @registry-id: dailyOpsSnapshotFetchDashboardBundle
 * @created: 2026-05-25T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Snapshot-first Daily Ops dashboard bundle orchestrator (ADR-004)
 * @last-fix: [2026-05-28] Split 808-line monolith into dashboardBundle modules
 * @adr-ref: ADR-004, ADR-006
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 * ✓ server/api/daily-ops/metrics/summary.get.ts
 * ✓ server/api/daily-ops/metrics/labor.get.ts
 * ✓ server/api/daily-ops/metrics/revenue-breakdown.get.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsLaborMetricsDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
} from '~/types/daily-ops-dashboard'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import {
  buildDailyOpsRevenueBreakdownDto,
  buildDailyOpsSummaryDto,
} from '../dailyOpsMetrics/dtoBuilders'
import { aggregateLaborForRange } from './aggregateLaborForRange'
import { buildProfitByIntervalFromSnapshotHourly } from './buildProfitByIntervalFromSnapshot'
import { buildRevenueDrilldownSection } from './buildRevenueDrilldownSection'
import { assembleLaborFromSnapshots } from './dashboardBundle/assembleLaborDto'
import {
  buildHourBundleFromSnapshots,
  categoryTotalsFromProducts,
} from './dashboardBundle/hourBundle'
import { contractRollupsFromSnapshotLabor } from './dashboardBundle/laborContractRollups'
import { loadSnapshotDashboardRows } from './dashboardBundle/loadSnapshotRows'
import {
  aggregateLaborByDateHour,
  laborByLocHourFromSnapshots,
  laborCostMapFromHourly,
} from './dashboardBundle/laborHourMaps'
import { buildHeadlineRevenueByLocDay, buildRevLabMaps } from './dashboardBundle/revLabMaps'
import { snapshotRound2 } from './dashboardBundle/shared'
import { buildTodayExtrasFromHourBundle } from './dashboardBundle/todayRevenueDetail'

export type DailyOpsDashboardBundleDto = {
  summary: DailyOpsSummaryDto
  revenue: DailyOpsRevenueBreakdownDto
  labor: DailyOpsLaborMetricsDto
}

/** Snapshot-only dashboard bundle — single coordinated read (ADR-004). */
export async function fetchDailyOpsDashboardBundle(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsDashboardBundleDto> {
  const rows = await loadSnapshotDashboardRows(db, ctx)
  const snapshotContracts = contractRollupsFromSnapshotLabor(rows.labor)
  const { revMap, labMap, revByDateLocation } = buildRevLabMaps(
    rows.masters,
    rows.revenue,
    rows.labor,
  )
  const cat = categoryTotalsFromProducts(rows.products)
  const hourBundle = buildHourBundleFromSnapshots(rows.hourly, rows.revenue)
  const headlineRevenueByLocDay = buildHeadlineRevenueByLocDay(rows.revenue)

  let apiMergedTotal = 0
  for (const r of rows.revenue) {
    apiMergedTotal += Number(r.borkTotals?.ex_vat ?? 0)
  }

  const laborByLocHour = laborByLocHourFromSnapshots(rows.labor)

  const [laborBreakdown, profitByInterval, drilldown] = await Promise.all([
    aggregateLaborForRange(db, {
      startDate: ctx.startDate,
      endDate: ctx.endDate,
      locationId: ctx.locationId,
    }),
    buildProfitByIntervalFromSnapshotHourly(
      ctx,
      hourBundle.byDayHour,
      cat,
      laborCostMapFromHourly(laborByLocHour),
      headlineRevenueByLocDay,
    ),
    buildRevenueDrilldownSection(db, ctx, {
      revenue: rows.revenue,
      hourly: rows.hourly,
      products: rows.products,
      tables: rows.tables,
      workers: rows.workers,
      laborByLocHour,
      headlineRevenueByLocDay,
      categoryTotals: cat,
    }),
  ])

  const summary = buildDailyOpsSummaryDto(ctx, revMap, labMap, {
    apiBusinessDaysTotal: snapshotRound2(apiMergedTotal),
    inboxBasisExVat: null,
  })
  if (laborBreakdown.coverage.daysFound > 0) {
    summary.summary.laborBreakdown = laborBreakdown
  }

  const laborByDateHour = aggregateLaborByDateHour(laborCostMapFromHourly(laborByLocHour))
  const revenue = buildDailyOpsRevenueBreakdownDto(
    ctx,
    cat,
    hourBundle,
    revMap,
    labMap,
    laborByDateHour,
    profitByInterval,
    ctx.startDate === ctx.endDate
      ? buildTodayExtrasFromHourBundle(ctx, hourBundle, rows.revenue, rows.orderTime, laborByLocHour)
      : undefined,
  )
  revenue.drilldown = drilldown

  const labor = assembleLaborFromSnapshots(ctx, rows, revMap, labMap, revByDateLocation, {
    hoursCostByContractType: snapshotContracts.hoursCostByContractType,
    contractTypeByDay: snapshotContracts.contractTypeByDay,
  })

  return { summary, revenue, labor }
}

export function snapshotCacheControl(ctx: DailyOpsMetricsContext): string {
  const sealedPast =
    ctx.period !== 'today' && ctx.startDate === ctx.endDate && ctx.endDate < new Date().toISOString().slice(0, 10)
  return sealedPast ? 'private, max-age=300' : 'no-store'
}
