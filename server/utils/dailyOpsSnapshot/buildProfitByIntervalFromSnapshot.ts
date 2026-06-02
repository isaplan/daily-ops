/**
 * @registry-id: dailyOpsSnapshotBuildProfitByInterval
 * @created: 2026-05-25T00:00:00.000Z
 * @last-modified: 2026-06-02T00:00:00.000Z
 * @description: Profit-by-interval cells from snapshot hourly revenue (no bork_* / eitje on GET).
 * @last-fix: [2026-06-02] Whole-euro rounding for interval P&L + drilldown currency fields
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import {
  formatProfitEstimatesNote,
  profitHourDefaultsFromPnlAssumptions,
  type ProfitHourDefaults,
} from '../dailyOpsMetrics/profitHour'
import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'
import { DEFAULT_PNL_ASSUMPTIONS } from '~/utils/dailyOpsPnlAssumptionsDefaults'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import type {
  DailyOpsProfitByIntervalDto,
  DailyOpsProfitIntervalCellDto,
  DailyOpsProfitIntervalKey,
} from '~/types/daily-ops-dashboard'
import {
  DAILY_OPS_PROFIT_INTERVAL_CHART_COLORS,
  DAILY_OPS_PROFIT_INTERVALS,
} from '~/utils/dailyOpsProfitIntervals'
import { snapshotLocDayKey } from './dashboardBundle/shared'
import { roundDashboardEur } from '~/utils/dashboardEurFormat'

const INTERVAL_MATCHERS: Record<DailyOpsProfitIntervalKey, (hour: number) => boolean> = {
  lunch: (h) => h >= 8 && h < 16,
  afternoon: (h) => h >= 16 && h < 18,
  dinner: (h) => h >= 18 && h < 22,
  late_night: (h) => h >= 22 || h < 8,
}

type LaborLocDay = { laborCost: number; hours: number; distinctWorkerCount: number }

function revenueKey(date: string, locationId: string): string {
  return snapshotLocDayKey(date, locationId)
}

function dayLoadedLaborForLocation(
  laborByLocDay: Map<string, LaborLocDay>,
  date: string,
  locationId: string | null,
): number {
  if (locationId) {
    return laborByLocDay.get(revenueKey(date, locationId))?.laborCost ?? 0
  }
  return VENUE_STRIP_LOCATIONS.reduce(
    (sum, v) => sum + (laborByLocDay.get(revenueKey(date, v.locationId))?.laborCost ?? 0),
    0,
  )
}

function targetHeadlineRevenue(
  headlineRevenueByLocDay: Map<string, number> | undefined,
  date: string,
  locationId: string | null,
): number | null {
  if (!headlineRevenueByLocDay) return null
  if (locationId) return headlineRevenueByLocDay.get(revenueKey(date, locationId)) ?? null
  return VENUE_STRIP_LOCATIONS.reduce(
    (sum, v) => sum + (headlineRevenueByLocDay.get(revenueKey(date, v.locationId)) ?? 0),
    0,
  )
}

function rawHeadlineRevenue(
  hourRows: { _id: { d: string; h: number; loc?: string }; revenue: number }[],
  date: string,
  locationId: string | null,
): number {
  return hourRows.reduce((sum, row) => {
    if (row._id.d !== date) return sum
    const loc = row._id.loc ?? ''
    if (locationId != null && loc !== locationId) return sum
    if (locationId == null && loc && !VENUE_STRIP_LOCATIONS.some((v) => v.locationId === loc)) return sum
    return sum + Number(row.revenue ?? 0)
  }, 0)
}

function computeCell(
  hourRows: { _id: { d: string; h: number; loc?: string }; revenue: number }[],
  laborByLocDay: Map<string, LaborLocDay>,
  headlineRevenueByLocDay: Map<string, number> | undefined,
  foodShare: number,
  date: string,
  locationId: string | null,
  intervalKey: DailyOpsProfitIntervalKey,
  intervalLabel: string,
  locationName: string,
  profitDefaults: ProfitHourDefaults,
): DailyOpsProfitIntervalCellDto {
  const def = INTERVAL_MATCHERS[intervalKey]
  let revenue = 0
  for (const row of hourRows) {
    if (row._id.d !== date) continue
    const h = Number(row._id.h)
    if (!def(h)) continue
    const loc = row._id.loc ?? ''
    if (locationId != null && loc !== locationId) continue
    if (locationId == null && loc && !VENUE_STRIP_LOCATIONS.some((v) => v.locationId === loc)) continue
    revenue += row.revenue
  }

  const rawTotal = rawHeadlineRevenue(hourRows, date, locationId)
  const targetTotal = targetHeadlineRevenue(headlineRevenueByLocDay, date, locationId)
  if (targetTotal != null && targetTotal > 0 && rawTotal > 0) {
    revenue *= targetTotal / rawTotal
  }

  const dayLoadedLabor = roundDashboardEur(dayLoadedLaborForLocation(laborByLocDay, date, locationId))
  const dayRevenue =
    targetTotal != null && targetTotal > 0
      ? targetTotal
      : rawTotal > 0
        ? rawTotal
        : 0

  const laborCost =
    dayRevenue > 0 && dayLoadedLabor > 0 ? roundDashboardEur(dayLoadedLabor * (revenue / dayRevenue)) : 0

  const foodRev = revenue * foodShare
  const bevRev = revenue - foodRev
  const cogs =
    foodRev * profitDefaults.foodCogsPct +
    bevRev * profitDefaults.beverageCogsPct
  const fixed = revenue * profitDefaults.fixedOverheadPct
  const profit = revenue - laborCost - cogs - fixed

  return {
    date,
    locationId,
    locationName,
    intervalKey,
    intervalLabel,
    revenue: roundDashboardEur(revenue),
    laborCost,
    cogsCost: roundDashboardEur(cogs),
    fixedCost: roundDashboardEur(fixed),
    profit: roundDashboardEur(profit),
    dayLoadedLabor,
    chartColor: DAILY_OPS_PROFIT_INTERVAL_CHART_COLORS[intervalKey],
  }
}

export async function buildProfitByIntervalFromSnapshotHourly(
  ctx: DailyOpsMetricsContext,
  hourRows: { _id: { d: string; h: number; loc?: string }; revenue: number }[],
  categoryTotals: { food: number; drinks: number },
  laborByLocDay: Map<string, LaborLocDay>,
  headlineRevenueByLocDay?: Map<string, number>,
  pnlAssumptions?: DailyOpsSimplePnLAssumptions,
): Promise<DailyOpsProfitByIntervalDto> {
  const profitDefaults = profitHourDefaultsFromPnlAssumptions(pnlAssumptions)
  const catTotal = categoryTotals.food + categoryTotals.drinks
  const foodShare = catTotal > 0 ? categoryTotals.food / catTotal : 0.5
  const dates = enumerateUtcDatesInclusive(ctx.startDate, ctx.endDate)

  const locationTargets: { locationId: string | null; locationName: string }[] =
    ctx.locationId !== undefined
      ? [
          {
            locationId: ctx.locationId,
            locationName:
              VENUE_STRIP_LOCATIONS.find((v) => v.locationId === ctx.locationId)?.locationName ?? 'Location',
          },
        ]
      : [
          { locationId: null, locationName: 'All locations' },
          ...VENUE_STRIP_LOCATIONS.map((v) => ({
            locationId: v.locationId,
            locationName: v.locationName,
          })),
        ]

  const cells: DailyOpsProfitIntervalCellDto[] = []
  for (const date of dates) {
    for (const loc of locationTargets) {
      for (const interval of DAILY_OPS_PROFIT_INTERVALS) {
        cells.push(
          computeCell(
            hourRows,
            laborByLocDay,
            headlineRevenueByLocDay,
            foodShare,
            date,
            loc.locationId,
            interval.key,
            interval.label,
            loc.locationName,
            profitDefaults,
          ),
        )
      }
    }
  }

  return {
    estimatesNote:
      `${formatProfitEstimatesNote(pnlAssumptions ?? DEFAULT_PNL_ASSUMPTIONS)} ` +
      `Interval labor allocates full-day loaded cost (same as venue strip) by interval revenue share.`,
    dates,
    cells,
  }
}
