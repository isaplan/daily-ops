/**
 * @registry-id: dailyOpsSnapshotFetchDashboardBundle
 * @created: 2026-05-25T00:00:00.000Z
 * @last-modified: 2026-07-28T14:05:34.000Z
 * @description: Snapshot-first Daily Ops dashboard bundle orchestrator (ADR-004/013)
 *   Reads sealed snapshot sections only; no Bork/Eitje/Inbox on GET. Orchestrates section reads
 *   → DTOs → write to read-cache (per ADR-013, snapshot write path SSOT).
 * @last-fix: [2026-07-28] Seal occupancyPct onto periodBreakdown rows
 *   Prior: [2026-07-20] Seal tableOccupancy into dashboard-bundle
 *   Prior: [2026-07-16] Extract light path + Cache-Control under monolith budget
 *   Prior: [2026-07-13] Updated metadata: snapshot-only, no live reads on GET
 *   Prior: [2026-07-11] Hourly periodBreakdown staff headcount from shift overlap buckets
 *   Prior: [2026-07-02] ADR-013 @write-cache-json — orchestrator feeds dashboard-bundle writer
 * @adr-ref: ADR-004, ADR-006, ADR-010, ADR-013
 * @data-source: snapshot-write-only
 * @write-cache-json: daily_ops_read_cache · dashboard-bundle · daily+weekly+monthly+yearly · orchestrator feeds preGenerateBundleCache after buildDailyOpsSnapshot
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
  PeriodBreakdownDto,
  VenueStripResponseDto,
} from '~/types/daily-ops-dashboard'
import type { DailyOpsTableOccupancyKpisDto } from '~/types/daily-ops-venue-tables'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import {
  buildDailyOpsRevenueBreakdownDto,
  buildDailyOpsSummaryDto,
} from '../dailyOpsMetrics/dtoBuilders'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { loadPnlAssumptions } from '../appSettings/pnlAssumptionsSetting'
import { fetchCheckInsLaborByBusinessDateHour } from '../venueStrip/checkInLaborByHour'
import { buildTableOccupancySummary } from '../dailyOpsVenueTables/buildTableOccupancySummary'
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
  mergeLaborHourMaps,
} from './dashboardBundle/laborHourMaps'
import { buildHeadlineRevenueByLocDay, buildRevLabMaps } from './dashboardBundle/revLabMaps'
import { snapshotRound2 } from './dashboardBundle/shared'
import { buildTodayExtrasFromHourBundle } from './dashboardBundle/todayRevenueDetail'
import { fetchDashboardBundleLight } from './dashboardBundle/fetchDashboardBundleLight'
import { headlineExVatFromSnapshotSection } from './snapshotHeadlineRevenue'
import { coverageFromSnapshotMasters, formatCoverageNote } from './bundleCoverage'
import {
  buildHourBreakdownFromDrilldown,
  buildPeriodBreakdownFromLaborMetrics,
  applyOccupancyToPeriodBreakdown,
} from './buildPeriodBreakdown'
import {
  fetchCheckInsStaffByBusinessDateHour,
  fetchStaffByBusinessDateHour,
  mergeStaffHourMaps,
} from './staffHourBuckets'

export type DailyOpsDashboardBundleDto = {
  summary: DailyOpsSummaryDto
  revenue: DailyOpsRevenueBreakdownDto
  labor: DailyOpsLaborMetricsDto
  /** 3-venue strip (locationId=all daily files only; aggregated on week/month/year). */
  venueStrip?: VenueStripResponseDto
  /** Hour/day/week/month bars for venue strip graph + period charts. */
  periodBreakdown?: PeriodBreakdownDto
  /** Active tables + bezettingsgraad (avg daily for multi-day). */
  tableOccupancy?: DailyOpsTableOccupancyKpisDto
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
    useOrderTimeHeadline: ctx.startDate === ctx.endDate && ctx.startDate === openRegister,
  }, { assumptions: pnlAssumptions, categoryTotals: cat })
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

  let staffByLocHour = await fetchStaffByBusinessDateHour(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId,
  })
  if (ctx.startDate === ctx.endDate && ctx.startDate === openRegister) {
    const checkInStaff = await fetchCheckInsStaffByBusinessDateHour(db, {
      startDate: ctx.startDate,
      endDate: ctx.endDate,
      locationId: ctx.locationId,
    })
    staffByLocHour = mergeStaffHourMaps(staffByLocHour, checkInStaff)
  }

  const periodBreakdown =
    ctx.startDate === ctx.endDate
      ? buildHourBreakdownFromDrilldown(drilldown, {
          businessDate: ctx.startDate,
          laborByLocHour,
          staffByLocHour,
        })
      : buildPeriodBreakdownFromLaborMetrics(labor, ctx.startDate, ctx.endDate, {
          assumptions: pnlAssumptions,
          categoryTotals: cat,
        })

  const tableOccupancy = await buildTableOccupancySummary(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: ctx.locationId,
    period: ctx.period,
  })

  return {
    summary,
    revenue,
    labor,
    periodBreakdown: applyOccupancyToPeriodBreakdown(periodBreakdown, tableOccupancy),
    tableOccupancy,
  }
}
