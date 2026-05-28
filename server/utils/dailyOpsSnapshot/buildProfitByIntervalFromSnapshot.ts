/**
 * @registry-id: dailyOpsSnapshotBuildProfitByInterval
 * @created: 2026-05-25T00:00:00.000Z
 * @last-modified: 2026-05-25T21:35:00.000Z
 * @description: Profit-by-interval cells from snapshot hourly revenue (no bork_* / eitje on GET).
 * @last-fix: [2026-05-25] Interval labor is supplied from snapshot hourly labor buckets.
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import {
  MOST_PROFITABLE_HOUR_DEFAULTS,
  MOST_PROFITABLE_HOUR_ESTIMATES_NOTE,
} from '../dailyOpsMetrics/profitHour'
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

const INTERVAL_MATCHERS: Record<DailyOpsProfitIntervalKey, (hour: number) => boolean> = {
  lunch: (h) => h >= 8 && h < 16,
  afternoon: (h) => h >= 16 && h < 18,
  dinner: (h) => h >= 18 && h < 22,
  late_night: (h) => h >= 22 || h < 8,
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function laborKey(locationId: string, day: string, hour: number): string {
  return `${locationId}|${day}|${hour}`
}

function revenueKey(date: string, locationId: string): string {
  return `${date}|${locationId}`
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
  laborByLocHour: Map<string, number>,
  headlineRevenueByLocDay: Map<string, number> | undefined,
  foodShare: number,
  date: string,
  locationId: string | null,
  intervalKey: DailyOpsProfitIntervalKey,
  intervalLabel: string,
  locationName: string,
): DailyOpsProfitIntervalCellDto {
  const def = INTERVAL_MATCHERS[intervalKey]
  let revenue = 0
  let laborCost = 0
  for (const row of hourRows) {
    if (row._id.d !== date) continue
    const h = Number(row._id.h)
    if (!def(h)) continue
    const loc = row._id.loc ?? ''
    if (locationId != null && loc !== locationId) continue
    revenue += row.revenue
    if (loc) laborCost += laborByLocHour.get(laborKey(loc, date, h)) ?? 0
    else {
      for (const v of VENUE_STRIP_LOCATIONS) {
        laborCost += laborByLocHour.get(laborKey(v.locationId, date, h)) ?? 0
      }
    }
  }

  const rawTotal = rawHeadlineRevenue(hourRows, date, locationId)
  const targetTotal = targetHeadlineRevenue(headlineRevenueByLocDay, date, locationId)
  if (targetTotal != null && targetTotal > 0 && rawTotal > 0) {
    revenue *= targetTotal / rawTotal
  }

  const foodRev = revenue * foodShare
  const bevRev = revenue - foodRev
  const cogs =
    foodRev * MOST_PROFITABLE_HOUR_DEFAULTS.foodCogsPct +
    bevRev * MOST_PROFITABLE_HOUR_DEFAULTS.beverageCogsPct
  const fixed = revenue * MOST_PROFITABLE_HOUR_DEFAULTS.fixedOverheadPct
  const profit = revenue - laborCost - cogs - fixed

  return {
    date,
    locationId,
    locationName,
    intervalKey,
    intervalLabel,
    revenue: round2(revenue),
    laborCost: round2(laborCost),
    cogsCost: round2(cogs),
    fixedCost: round2(fixed),
    profit: round2(profit),
    chartColor: DAILY_OPS_PROFIT_INTERVAL_CHART_COLORS[intervalKey],
  }
}

export async function buildProfitByIntervalFromSnapshotHourly(
  ctx: DailyOpsMetricsContext,
  hourRows: { _id: { d: string; h: number; loc?: string }; revenue: number }[],
  categoryTotals: { food: number; drinks: number },
  laborByLocHour: Map<string, number>,
  headlineRevenueByLocDay?: Map<string, number>,
): Promise<DailyOpsProfitByIntervalDto> {
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
            laborByLocHour,
            headlineRevenueByLocDay,
            foodShare,
            date,
            loc.locationId,
            interval.key,
            interval.label,
            loc.locationName,
          ),
        )
      }
    }
  }

  return {
    estimatesNote: MOST_PROFITABLE_HOUR_ESTIMATES_NOTE,
    dates,
    cells,
  }
}
