/**
 * @registry-id: dailyOpsSnapshotFetchDashboardBundle
 * @created: 2026-05-25T00:00:00.000Z
 * @last-modified: 2026-07-01T12:00:00.000Z
 * @last-fix: [2026-07-01] Patch open register-day revenue from order-time Bork aggregates before DTO build
 *   Prior: [2026-06-09] Merge live check_ins hourly labor into today P&L / profit-by-interval
 *   Prior: [2026-06-07] snapshotCacheControl uses open register business_date (ADR-010), not UTC ISO
 *   Prior: [2026-06-05] Cache sealed days 24h immutable; yesterday 1h + stale-while-revalidate
 *   Prior: [2026-06-05] Merge revenue-section hourly fallback + scale today hourly detail
 * @description: Snapshot-first Daily Ops dashboard bundle orchestrator (ADR-004)
 * @last-fix: [2026-05-31] Dashboard profit math uses Mongo P&L assumptions SSOT
 * @adr-ref: ADR-004, ADR-006, ADR-010
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
  DailyOpsProfitByIntervalDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
  VenueStripResponseDto,
} from '~/types/daily-ops-dashboard'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import {
  buildDailyOpsRevenueBreakdownDto,
  buildDailyOpsSummaryDto,
} from '../dailyOpsMetrics/dtoBuilders'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { loadPnlAssumptions } from '../appSettings/pnlAssumptionsSetting'
import { fetchCheckInsLaborByBusinessDateHour } from '../venueStrip/checkInLaborByHour'
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
import { loadSnapshotDashboardRows, loadSnapshotDashboardRowsLight } from './dashboardBundle/loadSnapshotRows'
import {
  aggregateLaborByDateHour,
  laborByLocHourFromSnapshots,
  laborCostMapFromHourly,
  mergeLaborHourMaps,
} from './dashboardBundle/laborHourMaps'
import { buildHeadlineRevenueByLocDay, buildRevLabMaps } from './dashboardBundle/revLabMaps'
import { snapshotRound2 } from './dashboardBundle/shared'
import { buildTodayExtrasFromHourBundle } from './dashboardBundle/todayRevenueDetail'
import { patchTodayRevenueRowsFromBork } from './dashboardBundle/patchTodayRevenueFromBork'
import { headlineExVatFromSnapshotSection } from './snapshotHeadlineRevenue'
import { coverageFromSnapshotMasters, formatCoverageNote } from './bundleCoverage'

export type DailyOpsDashboardBundleDto = {
  summary: DailyOpsSummaryDto
  revenue: DailyOpsRevenueBreakdownDto
  labor: DailyOpsLaborMetricsDto
  /** 3-venue strip (locationId=all daily files only; aggregated on week/month/year). */
  venueStrip?: VenueStripResponseDto
}

const EMPTY_PROFIT_BY_INTERVAL: DailyOpsProfitByIntervalDto = {
  estimatesNote: 'Profit-by-interval omitted for long ranges (>31 days).',
  dates: [],
  cells: [],
}

const EMPTY_PROFIT_HOUR: DailyOpsRevenueBreakdownDto['mostProfitableHour'] = {
  hourLabel: '—',
  date: '',
  hour: 0,
  revenue: 0,
  laborCost: 0,
  cogsCost: 0,
  fixedCost: 0,
  profit: 0,
  estimatesNote: 'Hourly profit omitted for long ranges (>31 days).',
}

/** Fast path for year-scale ranges — summary + labor rollups only. */
export async function fetchDashboardBundleLight(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsDashboardBundleDto> {
  const rows = await loadSnapshotDashboardRowsLight(db, ctx)
  const snapshotContracts = contractRollupsFromSnapshotLabor(rows.labor)
  const { revMap, labMap, revByDateLocation } = buildRevLabMaps(rows.masters, rows.revenue, rows.labor)

  let apiMergedTotal = 0
  for (const r of rows.revenue) {
    apiMergedTotal += Number(r.borkTotals?.ex_vat ?? 0)
  }

  const laborBreakdown = await aggregateLaborForRange(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId,
  })

  const summary = buildDailyOpsSummaryDto(ctx, revMap, labMap, {
    apiBusinessDaysTotal: snapshotRound2(apiMergedTotal),
    inboxBasisExVat: null,
  })
  if (laborBreakdown.coverage.daysFound > 0) {
    summary.summary.laborBreakdown = laborBreakdown
  }

  const revenue: DailyOpsRevenueBreakdownDto = {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    revenueByCategory: [],
    revenueByTimePeriod: [],
    mostProfitableHour: EMPTY_PROFIT_HOUR,
    profitByInterval: EMPTY_PROFIT_BY_INTERVAL,
  }

  const labor = assembleLaborFromSnapshots(ctx, rows, revMap, labMap, revByDateLocation, {
    hoursCostByContractType: snapshotContracts.hoursCostByContractType,
    contractTypeByDay: snapshotContracts.contractTypeByDay,
  })

  return { summary, revenue, labor }
}

/** Snapshot-only dashboard bundle — single coordinated read (ADR-004). */
export async function fetchDailyOpsDashboardBundle(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsDashboardBundleDto> {
  const rangeDays = enumerateUtcDatesInclusive(ctx.startDate, ctx.endDate).length
  if (rangeDays > 31) {
    return fetchDashboardBundleLight(db, ctx)
  }

  const rows = await loadSnapshotDashboardRows(db, ctx)
  await patchTodayRevenueRowsFromBork(db, ctx, rows.revenue)
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
    apiMergedTotal += headlineExVatFromSnapshotSection(r)
  }

  let laborByLocHour = laborByLocHourFromSnapshots(rows.labor)
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  if (ctx.startDate === ctx.endDate && ctx.startDate === openRegister) {
    const checkInHourly = await fetchCheckInsLaborByBusinessDateHour(db, {
      startDate: ctx.startDate,
      endDate: ctx.endDate,
      locationId: ctx.locationId,
    })
    laborByLocHour = mergeLaborHourMaps(laborByLocHour, checkInHourly)
  }
  const pnlAssumptions = await loadPnlAssumptions(db)

  const snapshotCoverage =
    ctx.startDate !== ctx.endDate ? coverageFromSnapshotMasters(ctx, rows.masters) : undefined
  const coverageNote = snapshotCoverage ? formatCoverageNote(snapshotCoverage) : null

  const [laborBreakdown, profitByIntervalRaw, drilldown] = await Promise.all([
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

  const profitByInterval = { ...profitByIntervalRaw }
  if (coverageNote) {
    profitByInterval.coverageNote = coverageNote
    profitByInterval.estimatesNote = `${profitByInterval.estimatesNote} ${coverageNote}`
  }

  const summary = buildDailyOpsSummaryDto(ctx, revMap, labMap, {
    apiBusinessDaysTotal: snapshotRound2(apiMergedTotal),
    inboxBasisExVat: null,
  })
  if (laborBreakdown.coverage.daysFound > 0) {
    summary.summary.laborBreakdown = laborBreakdown
  }
  if (snapshotCoverage) {
    summary.snapshotCoverage = snapshotCoverage
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
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const sealedSingleDay = ctx.period !== 'today' && ctx.startDate === ctx.endDate && ctx.endDate < openRegister

  if (sealedSingleDay) {
    const yesterday = addCalendarDaysYmd(openRegister, -1)
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
