/**
 * @registry-id: dailyOpsSnapshotFetchDashboardBundle
 * @created: 2026-05-25T00:00:00.000Z
 * @last-modified: 2026-06-05T17:50:00.000Z
 * @last-fix: [2026-06-05] Cache sealed days 24h immutable; yesterday 1h + stale-while-revalidate
 *   Prior: [2026-06-05] Merge revenue-section hourly fallback + scale today hourly detail
 * @description: Snapshot-first Daily Ops dashboard bundle orchestrator (ADR-004)
 * @last-fix: [2026-05-31] Dashboard profit math uses Mongo P&L assumptions SSOT
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
import { loadPnlAssumptions } from '../appSettings/pnlAssumptionsSetting'
import { aggregateLaborForRange } from './aggregateLaborForRange'
import { buildProfitByIntervalFromSnapshotHourly } from './buildProfitByIntervalFromSnapshot'
import { buildRevenueDrilldownSection } from './buildRevenueDrilldownSection'
import { assembleLaborFromSnapshots } from './dashboardBundle/assembleLaborDto'
import {
  buildHourBundleFromSnapshots,
  categoryTotalsFromProducts,
  mergeHourlySnapshotSections,
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
  const { revMap, labMap, revByDateLocation, laborByLocDay } = buildRevLabMaps(
    rows.masters,
    rows.revenue,
    rows.labor,
  )
  const cat = categoryTotalsFromProducts(rows.products)
  const mergedHourly = mergeHourlySnapshotSections(rows.hourly, rows.revenue)
  const hourBundle = buildHourBundleFromSnapshots(mergedHourly, [])
  const headlineRevenueByLocDay = buildHeadlineRevenueByLocDay(rows.revenue)

  let apiMergedTotal = 0
  for (const r of rows.revenue) {
    apiMergedTotal += Number(r.borkTotals?.ex_vat ?? 0)
  }

  const laborByLocHour = laborByLocHourFromSnapshots(rows.labor)
  const pnlAssumptions = await loadPnlAssumptions(db)

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
      laborByLocDay,
      headlineRevenueByLocDay,
      pnlAssumptions,
      laborByLocHour,
    ),
    buildRevenueDrilldownSection(db, ctx, {
      revenue: rows.revenue,
      hourly: mergedHourly,
      products: rows.products,
      tables: rows.tables,
      workers: rows.workers,
      laborByLocHour,
      headlineRevenueByLocDay,
      categoryTotals: cat,
    }, pnlAssumptions),
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
      ? buildTodayExtrasFromHourBundle(
          ctx,
          hourBundle,
          rows.revenue,
          rows.orderTime,
          laborByLocHour,
          headlineRevenueByLocDay,
        )
      : undefined,
    pnlAssumptions,
  )
  revenue.drilldown = drilldown

  const labor = assembleLaborFromSnapshots(ctx, rows, revMap, labMap, revByDateLocation, {
    hoursCostByContractType: snapshotContracts.hoursCostByContractType,
    contractTypeByDay: snapshotContracts.contractTypeByDay,
  })

  return { summary, revenue, labor }
}

export function snapshotCacheControl(ctx: DailyOpsMetricsContext): string {
  const today = new Date().toISOString().slice(0, 10)
  const sealedSingleDay = ctx.period !== 'today' && ctx.startDate === ctx.endDate && ctx.endDate < today

  if (sealedSingleDay) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (ctx.endDate === yesterday) {
      // Yesterday: 1h cache, revalidate in background (morning cron might update)
      return 'public, max-age=3600, stale-while-revalidate=86400'
    }
    // Older sealed days: 24h cache, immutable (only weekly backfills update)
    return 'public, max-age=86400, stale-while-revalidate=604800, immutable'
  }

  // Today or multi-day ranges: no cache
  return 'no-store'
}
