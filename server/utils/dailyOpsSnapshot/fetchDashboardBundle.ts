/**
 * @registry-id: dailyOpsSnapshotFetchDashboardBundle
 * @created: 2026-05-25T00:00:00.000Z
 * @last-modified: 2026-08-09T17:25:00.000Z
 * @description: Snapshot dashboard bundle — Today GET live path + write-path builder
 * @last-fix: [2026-08-09] GET Today exception via loadDashboardBundleForGet; ratios from ratio snapshot
 *   Prior: [2026-08-09] Food/bev from period-cache; sealed GETs use period-cache assemble
 * @adr-ref: ADR-004, ADR-006, ADR-010, ADR-013, PERIOD_CACHE_ADR L2, L3
 * @data-source: snapshot + check_ins (Today GET); period-cache food/bev categories
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/loadDashboardBundleForGet.ts (Today only)
 * ✓ server/utils/dailyOpsSnapshot/cacheCascade.ts (write-path pregen)
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
import { loadRatioSnapshotForDay } from '../dailyOpsPeriodCache/ratioSnapshot'
import { fetchCheckInsLaborByBusinessDateHour } from '../venueStrip/checkInLaborByHour'
import { buildTableOccupancySummary } from '../dailyOpsVenueTables/buildTableOccupancySummary'
import { aggregateLaborForRange } from './aggregateLaborForRange'
import { buildProfitByIntervalFromSnapshotHourly } from './buildProfitByIntervalFromSnapshot'
import { buildRevenueDrilldownSection } from './buildRevenueDrilldownSection'
import { assembleLaborFromSnapshots } from './dashboardBundle/assembleLaborDto'
import {
  buildHourBundleFromSnapshots,
  categoryTotalsFromPeriodCache,
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
  const cat = await categoryTotalsFromPeriodCache(
    db,
    { startDate: ctx.startDate, endDate: ctx.endDate, locationId: ctx.locationId },
  )
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
  let pnlAssumptions = await loadPnlAssumptions(db)
  // Today: COGS/overhead % from shared ratio snapshot (not finished day period-cache).
  if (ctx.startDate === ctx.endDate && ctx.startDate === openRegister) {
    const ratioLoc =
      ctx.locationId && ctx.locationId !== 'all' ? ctx.locationId : 'all'
    const ratio = await loadRatioSnapshotForDay(db, ctx.startDate, ratioLoc)
    if (ratio) {
      pnlAssumptions = {
        foodCogsPct: ratio.foodCogsPct,
        bevCogsPct: ratio.bevCogsPct,
        overheadPct: ratio.overheadPct,
      }
    }
  }

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
