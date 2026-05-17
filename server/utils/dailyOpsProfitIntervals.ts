import { ObjectId } from 'mongodb'
import type { Db } from 'mongodb'
import type { DailyOpsMetricsContext } from './dailyOpsDashboardMetrics'
import {
  MOST_PROFITABLE_HOUR_DEFAULTS,
  MOST_PROFITABLE_HOUR_ESTIMATES_NOTE,
  enumerateUtcDatesInclusive,
} from './dailyOpsDashboardMetrics'
import { resolveBorkAggReadSuffix } from './borkAggVersionSuffix'
import { VENUE_STRIP_LOCATIONS } from './dailyOpsVenueStrip'
import { fetchLaborCostByBusinessDateHour } from './eitjeLaborByHour'
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
  lunch: (h) => h < 16,
  afternoon: (h) => h >= 16 && h < 18,
  dinner: (h) => h >= 18 && h < 22,
  late_night: (h) => h >= 22 || h <= 3,
}

function borkHourLocMatch (ctx: DailyOpsMetricsContext): Record<string, unknown> {
  return {
    business_date: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
}

function normalizeLocationId (raw: unknown): string {
  if (raw == null) return 'unknown'
  if (typeof raw === 'string') return raw
  if (raw instanceof ObjectId) return raw.toString()
  return String(raw)
}

export async function fetchBorkRevenueByDayHourLocation (
  db: Db,
  ctx: DailyOpsMetricsContext
): Promise<{ _id: { d: string; h: number; loc: string }; revenue: number }[]> {
  const sfx = resolveBorkAggReadSuffix()
  return (await db
    .collection(`bork_sales_by_hour${sfx}`)
    .aggregate([
      { $match: borkHourLocMatch(ctx) },
      {
        $group: {
          _id: {
            d: '$business_date',
            h: '$calendar_hour',
            loc: { $toString: '$locationId' },
          },
          revenue: { $sum: { $ifNull: ['$total_revenue', 0] } },
        },
      },
    ])
    .toArray()) as { _id: { d: string; h: number; loc: string }; revenue: number }[]
}

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function laborKey (locationId: string, day: string, hour: number): string {
  return `${locationId}|${day}|${hour}`
}

function computeCell (
  hourRows: { _id: { d: string; h: number; loc: string }; revenue: number }[],
  laborByLocHour: Map<string, number>,
  foodShare: number,
  date: string,
  locationId: string | null,
  intervalKey: DailyOpsProfitIntervalKey,
  intervalLabel: string,
  locationName: string
): DailyOpsProfitIntervalCellDto {
  const def = INTERVAL_MATCHERS[intervalKey]
  let revenue = 0
  let laborCost = 0

  for (const row of hourRows) {
    if (row._id.d !== date) continue
    const h = Number(row._id.h)
    if (!def(h)) continue
    const loc = normalizeLocationId(row._id.loc)
    if (locationId != null && loc !== locationId) continue
    revenue += row.revenue
    laborCost += laborByLocHour.get(laborKey(loc, date, h)) ?? 0
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

export async function buildDailyOpsProfitByIntervalDto (
  db: Db,
  ctx: DailyOpsMetricsContext,
  categoryTotals: { food: number; drinks: number }
): Promise<DailyOpsProfitByIntervalDto> {
  const hourRows = await fetchBorkRevenueByDayHourLocation(db, ctx)
  const laborByLocHour = await fetchLaborCostByBusinessDateHour(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
  }, { perLocation: true })

  const catTotal = categoryTotals.food + categoryTotals.drinks
  const foodShare = catTotal > 0 ? categoryTotals.food / catTotal : 0.5
  const dates = enumerateUtcDatesInclusive(ctx.startDate, ctx.endDate)

  const locationTargets: { locationId: string | null; locationName: string }[] =
    ctx.locationId !== undefined
      ? [
          {
            locationId: ctx.locationId,
            locationName:
              VENUE_STRIP_LOCATIONS.find((v) => v.locationId === ctx.locationId)?.locationName ??
              'Location',
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
            foodShare,
            date,
            loc.locationId,
            interval.key,
            interval.label,
            loc.locationName
          )
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
