/**
 * Daily Ops dashboard: Bork revenue + Eitje labor aggregations (fast paths on prebuilt collections).
 */
import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import type {
  DailyOpsLaborDayDto,
  DailyOpsLaborMetricsDto,
  DailyOpsPeriodId,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
} from '~/types/daily-ops-dashboard'

const VAT_DISCLAIMER = 'All revenue values shown are excluding VAT (ex VAT)'

const DRINK_NAME_PATTERN =
  /wine|wijn|beer|bier|gint|gin |vodka|whisk|whiskey|rum|cocktail|cola|sprite|fanta|coffee|koffie|thee|tea|sap|juice|fris|prosecco|champagne|cider|tonic|latte|cappuccino|espresso|pils|stelz|borrel|aperol|campari|martini|soda|limonade/i

export type DailyOpsMetricsContext = {
  period: DailyOpsPeriodId
  startDate: string
  endDate: string
  locationId: ObjectId | string | undefined
  eitjeLocationId?: string | number | undefined
}

export function parseDailyOpsMetricsQuery(q: Record<string, unknown>): DailyOpsMetricsContext {
  const periodRaw = typeof q.period === 'string' ? q.period : 'today'
  const anchor = typeof q.anchor === 'string' ? q.anchor : undefined
  const range = resolveDailyOpsPeriod(periodRaw, anchor)
  const locRaw = typeof q.location === 'string' ? q.location : undefined
  let locationId: ObjectId | string | undefined
  if (locRaw && locRaw !== 'all') {
    try {
      locationId = new ObjectId(locRaw)
    } catch {
      locationId = locRaw
    }
  }
  return {
    period: range.period,
    startDate: range.startDate,
    endDate: range.endDate,
    locationId,
  }
}

export async function resolveUnifiedLocationToEitjeId(db: Db, unifiedId: ObjectId | string): Promise<string | number | undefined> {
  if (!unifiedId) return undefined
  const objId = typeof unifiedId === 'string' ? new ObjectId(unifiedId) : unifiedId
  const doc = await db.collection('unified_location').findOne({ _id: objId })
  return doc?.eitjeIds?.[0]
}

export function enumerateUtcDatesInclusive(start: string, end: string): string[] {
  const out: string[] = []
  const [ys, ms, ds] = start.split('-').map(Number)
  const [ye, me, de] = end.split('-').map(Number)
  let y = ys ?? 0
  let m = ms ?? 1
  let d = ds ?? 1
  const endT = new Date(Date.UTC(ye ?? 0, (me ?? 1) - 1, de ?? 1)).getTime()
  let cur = new Date(Date.UTC(y, m - 1, d)).getTime()
  while (cur <= endT) {
    const dt = new Date(cur)
    const p = (n: number) => String(n).padStart(2, '0')
    out.push(`${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`)
    cur += 86400000
  }
  return out
}

function timePeriodKey(hour: number): 'lunch' | 'pre_drinks' | 'dinner' | 'after_drinks' | 'other' {
  if (hour >= 11 && hour <= 14) return 'lunch'
  if (hour >= 15 && hour <= 16) return 'pre_drinks'
  if (hour >= 17 && hour <= 21) return 'dinner'
  if (hour >= 22 || hour <= 3) return 'after_drinks'
  return 'other'
}

function borkCronMatch(ctx: DailyOpsMetricsContext): Record<string, unknown> {
  const q: Record<string, unknown> = {
    date: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId !== undefined) q.locationId = ctx.locationId
  return q
}

function eitjeAggMatch(ctx: DailyOpsMetricsContext): Record<string, unknown> {
  const q: Record<string, unknown> = {
    period_type: 'day',
    period: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId !== undefined) q.locationId = ctx.locationId
  return q
}

export async function fetchBorkRevenueTotals(db: Db, ctx: DailyOpsMetricsContext) {
  const [row] = await db
    .collection('bork_sales_by_cron')
    .aggregate([
      { $match: borkCronMatch(ctx) },
      {
        $group: {
          _id: null,
          total_revenue: { $sum: { $ifNull: ['$total_revenue', 0] } },
        },
      },
    ])
    .toArray()
  const r = row as { total_revenue?: number } | undefined
  return { totalRevenue: r?.total_revenue ?? 0 }
}

export async function fetchEitjeLaborTotals(db: Db, ctx: DailyOpsMetricsContext) {
  const [row] = await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      { $match: eitjeAggMatch(ctx) },
      {
        $group: {
          _id: null,
          total_hours: { $sum: { $ifNull: ['$total_hours', 0] } },
          total_cost: { $sum: { $ifNull: ['$total_cost', 0] } },
        },
      },
    ])
    .toArray()
  const r = row as { total_hours?: number; total_cost?: number } | undefined
  return { totalHours: r?.total_hours ?? 0, totalLaborCost: r?.total_cost ?? 0 }
}

/**
 * Drinks vs food from `bork_sales_by_hour.products` (rebuilt by Bork aggregation from raw tickets).
 * Same name-pattern heuristic as legacy raw pipeline; no `bork_raw_data` scan.
 * Hour-level revenue minus summed product lines is added to food (missing/empty product arrays).
 */
export async function fetchRevenueByCategoryFromHourAggregates(db: Db, ctx: DailyOpsMetricsContext) {
  const match = borkCronMatch(ctx)

  const [facetRow] = (await db
    .collection('bork_sales_by_hour')
    .aggregate([
      { $match: match },
      {
        $facet: {
          categoryFromLines: [
            { $unwind: { path: '$products', preserveNullAndEmptyArrays: false } },
            {
              $addFields: {
                productName: { $ifNull: ['$products.productName', ''] },
                lineValue: { $toDouble: { $ifNull: ['$products.revenue', 0] } },
              },
            },
            {
              $addFields: {
                bucket: {
                  $cond: {
                    if: { $regexMatch: { input: '$productName', regex: DRINK_NAME_PATTERN } },
                    then: 'drinks',
                    else: 'food',
                  },
                },
              },
            },
            { $group: { _id: '$bucket', amount: { $sum: '$lineValue' } } },
          ],
          hourRevenueTotal: [
            { $group: { _id: null, total: { $sum: { $ifNull: ['$total_revenue', 0] } } } },
          ],
          productLinesTotal: [
            { $unwind: { path: '$products', preserveNullAndEmptyArrays: false } },
            {
              $group: {
                _id: null,
                total: { $sum: { $toDouble: { $ifNull: ['$products.revenue', 0] } } },
              },
            },
          ],
        },
      },
    ])
    .toArray()) as {
    categoryFromLines: { _id: string; amount: number }[]
    hourRevenueTotal: { _id: null; total: number }[]
    productLinesTotal: { _id: null; total: number }[]
  }[]

  const byCat = facetRow?.categoryFromLines ?? []
  let drinks = byCat.find((x) => x._id === 'drinks')?.amount ?? 0
  let food = byCat.find((x) => x._id === 'food')?.amount ?? 0
  const hourGrand = facetRow?.hourRevenueTotal?.[0]?.total ?? 0
  const lineGrand = facetRow?.productLinesTotal?.[0]?.total ?? 0
  const gap = Math.max(0, hourGrand - lineGrand)
  food += gap

  return { drinks, food }
}

/** @deprecated Use fetchRevenueByCategoryFromHourAggregates (reads `bork_sales_by_hour`, not raw). */
export const fetchRevenueByCategoryFromRaw = fetchRevenueByCategoryFromHourAggregates

export type BorkHourAggregatesBundle = {
  byHourOnly: { _id: number; amount: number }[]
  byDayHour: { _id: { d: string; h: number }; revenue: number }[]
}

/** One pass over `bork_sales_by_hour` for time-period totals and per-day-hour revenue. */
export async function fetchBorkHourAggregatesBundle(db: Db, ctx: DailyOpsMetricsContext): Promise<BorkHourAggregatesBundle> {
  const [row] = (await db
    .collection('bork_sales_by_hour')
    .aggregate([
      { $match: borkCronMatch(ctx) },
      {
        $facet: {
          byHourOnly: [
            {
              $group: {
                _id: '$hour',
                amount: { $sum: { $ifNull: ['$total_revenue', 0] } },
              },
            },
          ],
          byDayHour: [
            {
              $group: {
                _id: { d: '$date', h: '$hour' },
                revenue: { $sum: { $ifNull: ['$total_revenue', 0] } },
              },
            },
          ],
        },
      },
    ])
    .toArray()) as { byHourOnly: BorkHourAggregatesBundle['byHourOnly']; byDayHour: BorkHourAggregatesBundle['byDayHour'] }[]

  return {
    byHourOnly: row?.byHourOnly ?? [],
    byDayHour: row?.byDayHour ?? [],
  }
}

export function revenueByTimePeriodFromHourTotals(rows: { _id: number; amount: number }[]) {
  const sums = {
    lunch: 0,
    pre_drinks: 0,
    dinner: 0,
    after_drinks: 0,
    other: 0,
  }
  for (const r of rows) {
    const k = timePeriodKey(Number(r._id))
    sums[k] += r.amount
  }
  return sums
}

export async function fetchRevenueByTimePeriod(db: Db, ctx: DailyOpsMetricsContext) {
  const rows = (await db
    .collection('bork_sales_by_hour')
    .aggregate([
      { $match: borkCronMatch(ctx) },
      {
        $group: {
          _id: '$hour',
          amount: { $sum: { $ifNull: ['$total_revenue', 0] } },
        },
      },
    ])
    .toArray()) as { _id: number; amount: number }[]

  return revenueByTimePeriodFromHourTotals(rows)
}

export async function fetchHourlyRevenueForRange(db: Db, ctx: DailyOpsMetricsContext) {
  return (await db
    .collection('bork_sales_by_hour')
    .aggregate([
      { $match: borkCronMatch(ctx) },
      {
        $group: {
          _id: { d: '$date', h: '$hour' },
          revenue: { $sum: { $ifNull: ['$total_revenue', 0] } },
        },
      },
    ])
    .toArray()) as { _id: { d: string; h: number }; revenue: number }[]
}

export async function fetchRevenueByDate(db: Db, ctx: DailyOpsMetricsContext) {
  const rows = (await db
    .collection('bork_sales_by_cron')
    .aggregate([
      { $match: borkCronMatch(ctx) },
      { $group: { _id: '$date', revenue: { $sum: { $ifNull: ['$total_revenue', 0] } } } },
    ])
    .toArray()) as { _id: string; revenue: number }[]

  return new Map(rows.map((r) => [r._id, r.revenue]))
}

const LOC_DAY_KEY_SEP = '\x1f'

/** Stable key for `date` + Bork/Eitje `locationId` string (revenue & labor rollups). */
export function locationDayKey (date: string, locationId: string): string {
  return `${date}${LOC_DAY_KEY_SEP}${String(locationId)}`
}

export function parseLocationDayKey (key: string): { date: string; locationId: string } {
  const i = key.indexOf(LOC_DAY_KEY_SEP)
  if (i <= 0) return { date: key, locationId: '' }
  return { date: key.slice(0, i), locationId: key.slice(i + LOC_DAY_KEY_SEP.length) }
}

/** Revenue per calendar day and venue (ex VAT, from `bork_sales_by_cron`). */
export async function fetchRevenueByDateAndLocation (db: Db, ctx: DailyOpsMetricsContext): Promise<Map<string, number>> {
  const rows = (await db
    .collection('bork_sales_by_cron')
    .aggregate([
      { $match: borkCronMatch(ctx) },
      {
        $group: {
          _id: { date: '$date', locationId: '$locationId' },
          revenue: { $sum: { $ifNull: ['$total_revenue', 0] } },
        },
      },
    ])
    .toArray()) as { _id: { date: string; locationId: unknown }; revenue: number }[]

  const map = new Map<string, number>()
  for (const r of rows) {
    const lid = r._id.locationId != null ? String(r._id.locationId) : 'unknown'
    map.set(locationDayKey(r._id.date, lid), r.revenue)
  }
  return map
}

export async function fetchLaborByDate(db: Db, ctx: DailyOpsMetricsContext) {
  const rows = (await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      { $match: eitjeAggMatch(ctx) },
      {
        $group: {
          _id: '$period',
          laborCost: { $sum: { $ifNull: ['$total_cost', 0] } },
          hours: { $sum: { $ifNull: ['$total_hours', 0] } },
          workerIds: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          _id: 1,
          laborCost: 1,
          hours: 1,
          distinctWorkerCount: {
            $size: {
              $filter: { input: '$workerIds', as: 'w', cond: { $ne: ['$$w', null] } },
            },
          },
        },
      },
    ])
    .toArray()) as { _id: string; laborCost: number; hours: number; distinctWorkerCount: number }[]

  return new Map(
    rows.map((r) => [
      r._id,
      { laborCost: r.laborCost, hours: r.hours, distinctWorkerCount: r.distinctWorkerCount },
    ])
  )
}

export type ContractTypeDayRow = {
  date: string
  contractType: string
  workerCount: number
  totalHours: number
  totalCost: number
}

/** Hours, cost, and distinct workers per calendar day and contract type (from members.contract_type). */
export async function fetchHoursCostByContractTypeByDay(db: Db, ctx: DailyOpsMetricsContext) {
  return (await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      { $match: eitjeAggMatch(ctx) },
      {
        $lookup: {
          from: 'members',
          let: { uid: { $toString: '$userId' } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: [{ $toString: '$eitje_id' }, '$$uid'] },
                    {
                      $gt: [
                        {
                          $size: {
                            $filter: {
                              input: { $ifNull: ['$eitje_ids', []] },
                              as: 'x',
                              cond: { $eq: [{ $toString: '$$x' }, '$$uid'] },
                            },
                          },
                        },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { contract_type: 1 } },
          ],
          as: '_m',
        },
      },
      {
        $addFields: {
          contractType: {
            $ifNull: [{ $arrayElemAt: ['$_m.contract_type', 0] }, '-'],
          },
        },
      },
      {
        $group: {
          _id: { period: '$period', contractType: '$contractType' },
          workerIds: { $addToSet: '$userId' },
          total_hours: { $sum: { $ifNull: ['$total_hours', 0] } },
          total_cost: { $sum: { $ifNull: ['$total_cost', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id.period',
          contractType: '$_id.contractType',
          workerCount: {
            $size: {
              $filter: { input: '$workerIds', as: 'w', cond: { $ne: ['$$w', null] } },
            },
          },
          totalHours: { $round: ['$total_hours', 2] },
          totalCost: { $round: ['$total_cost', 2] },
        },
      },
      { $sort: { contractType: 1, date: 1 } },
    ])
    .toArray()) as ContractTypeDayRow[]
}

export function computeMostProfitableHour(
  hourRows: { _id: { d: string; h: number }; revenue: number }[],
  revenueByDate: Map<string, number>,
  laborByDate: Map<string, { laborCost: number; hours: number }>
) {
  let best = {
    hourLabel: '—',
    date: '',
    hour: 0,
    revenue: 0,
    laborCost: 0,
    profit: 0,
  }
  for (const row of hourRows) {
    const day = row._id.d
    const h = row._id.h
    const rev = row.revenue
    const dayRev = revenueByDate.get(day) ?? 0
    const dayLab = laborByDate.get(day)?.laborCost ?? 0
    const alloc = dayRev > 0 ? dayLab * (rev / dayRev) : 0
    const profit = rev - alloc
    if (profit > best.profit) {
      best = {
        hourLabel: `${day} ${String(h).padStart(2, '0')}:00`,
        date: day,
        hour: h,
        revenue: rev,
        laborCost: alloc,
        profit,
      }
    }
  }
  return best
}

export async function fetchWorkersByTeamLocation(db: Db, ctx: DailyOpsMetricsContext) {
  return (await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      { $match: eitjeAggMatch(ctx) },
      {
        $group: {
          _id: {
            locationId: '$locationId',
            location_name: '$location_name',
            teamId: '$teamId',
            team_name: '$team_name',
          },
          workerIds: { $addToSet: '$userId' },
          total_hours: { $sum: { $ifNull: ['$total_hours', 0] } },
          total_cost: { $sum: { $ifNull: ['$total_cost', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          locationId: { $toString: '$_id.locationId' },
          locationName: { $ifNull: ['$_id.location_name', ''] },
          teamId: { $toString: '$_id.teamId' },
          teamName: { $ifNull: ['$_id.team_name', ''] },
          workerCount: {
            $size: {
              $filter: { input: '$workerIds', as: 'w', cond: { $ne: ['$$w', null] } },
            },
          },
          totalHours: { $round: ['$total_hours', 2] },
          totalCost: { $round: ['$total_cost', 2] },
        },
      },
      { $sort: { locationName: 1, teamName: 1 } },
    ])
    .toArray()) as {
    locationId: string
    locationName: string
    teamId: string
    teamName: string
    workerCount: number
    totalHours: number
    totalCost: number
  }[]
}

export type WorkersTeamLocationDayRow = {
  date: string
  locationId: string
  locationName: string
  teamId: string
  teamName: string
  workerCount: number
  totalHours: number
  totalCost: number
}

/** Same as period rollup, but grouped by calendar day (period) + location + team. */
export async function fetchWorkersByTeamLocationByDay(db: Db, ctx: DailyOpsMetricsContext) {
  return (await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      { $match: eitjeAggMatch(ctx) },
      {
        $group: {
          _id: {
            period: '$period',
            locationId: '$locationId',
            location_name: '$location_name',
            teamId: '$teamId',
            team_name: '$team_name',
          },
          workerIds: { $addToSet: '$userId' },
          total_hours: { $sum: { $ifNull: ['$total_hours', 0] } },
          total_cost: { $sum: { $ifNull: ['$total_cost', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id.period',
          locationId: { $toString: '$_id.locationId' },
          locationName: { $ifNull: ['$_id.location_name', ''] },
          teamId: { $toString: '$_id.teamId' },
          teamName: { $ifNull: ['$_id.team_name', ''] },
          workerCount: {
            $size: {
              $filter: { input: '$workerIds', as: 'w', cond: { $ne: ['$$w', null] } },
            },
          },
          totalHours: { $round: ['$total_hours', 2] },
          totalCost: { $round: ['$total_cost', 2] },
        },
      },
      { $sort: { locationName: 1, teamName: 1, date: 1 } },
    ])
    .toArray()) as WorkersTeamLocationDayRow[]
}

export async function fetchHoursCostByContractType(db: Db, ctx: DailyOpsMetricsContext) {
  return (await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      { $match: eitjeAggMatch(ctx) },
      {
        $group: {
          _id: { userId: '$userId' },
          total_hours: { $sum: { $ifNull: ['$total_hours', 0] } },
          total_cost: { $sum: { $ifNull: ['$total_cost', 0] } },
        },
      },
      {
        $lookup: {
          from: 'members',
          let: { uid: { $toString: '$_id.userId' } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: [{ $toString: '$eitje_id' }, '$$uid'] },
                    {
                      $gt: [
                        {
                          $size: {
                            $filter: {
                              input: { $ifNull: ['$eitje_ids', []] },
                              as: 'x',
                              cond: { $eq: [{ $toString: '$$x' }, '$$uid'] },
                            },
                          },
                        },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { contract_type: 1 } },
          ],
          as: '_m',
        },
      },
      {
        $addFields: {
          contractType: {
            $ifNull: [{ $arrayElemAt: ['$_m.contract_type', 0] }, '-'],
          },
        },
      },
      {
        $group: {
          _id: '$contractType',
          totalHours: { $sum: '$total_hours' },
          totalCost: { $sum: '$total_cost' },
        },
      },
      {
        $project: {
          _id: 0,
          contractType: { $ifNull: ['$_id', '-'] },
          totalHours: { $round: ['$totalHours', 2] },
          totalCost: { $round: ['$totalCost', 2] },
        },
      },
      { $sort: { totalCost: -1 } },
    ])
    .toArray()) as { contractType: string; totalHours: number; totalCost: number }[]
}

export async function fetchLaborProductivityByLocationDay(db: Db, ctx: DailyOpsMetricsContext) {
  const revRows = (await db
    .collection('bork_sales_by_cron')
    .aggregate([
      { $match: borkCronMatch(ctx) },
      {
        $group: {
          _id: { date: '$date', locationId: '$locationId', locationName: '$locationName' },
          revenue: { $sum: { $ifNull: ['$total_revenue', 0] } },
        },
      },
    ])
    .toArray()) as {
    _id: { date: string; locationId: unknown; locationName?: string }
    revenue: number
  }[]

  const labRows = (await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      { $match: eitjeAggMatch(ctx) },
      {
        $group: {
          _id: { period: '$period', locationId: '$locationId', location_name: '$location_name' },
          hours: { $sum: { $ifNull: ['$total_hours', 0] } },
          laborCost: { $sum: { $ifNull: ['$total_cost', 0] } },
        },
      },
    ])
    .toArray()) as {
    _id: { period: string; locationId: unknown; location_name?: string }
    hours: number
    laborCost: number
  }[]

  type DayLoc = { date: string; revenuePerLaborHour: number; revenue: number; hours: number }
  const byLoc = new Map<string, { name: string; days: DayLoc[] }>()

  const locKey = (id: unknown) => (id != null ? String(id) : 'unknown')

  for (const r of revRows) {
    const lk = locKey(r._id.locationId)
    if (!byLoc.has(lk)) {
      byLoc.set(lk, { name: r._id.locationName ?? lk, days: [] })
    }
    const entry = byLoc.get(lk)!
    if (r._id.locationName) entry.name = r._id.locationName
    let d = entry.days.find((x) => x.date === r._id.date)
    if (!d) {
      d = { date: r._id.date, revenuePerLaborHour: 0, revenue: 0, hours: 0 }
      entry.days.push(d)
    }
    d.revenue += r.revenue
  }

  for (const r of labRows) {
    const lk = locKey(r._id.locationId)
    if (!byLoc.has(lk)) {
      byLoc.set(lk, { name: r._id.location_name ?? lk, days: [] })
    }
    const entry = byLoc.get(lk)!
    if (r._id.location_name) entry.name = r._id.location_name
    let d = entry.days.find((x) => x.date === r._id.period)
    if (!d) {
      d = { date: r._id.period, revenuePerLaborHour: 0, revenue: 0, hours: 0 }
      entry.days.push(d)
    }
    d.hours += r.hours
  }

  const out: {
    locationId: string
    locationName: string
    highest: { date: string; revenuePerLaborHour: number; revenue: number; hours: number } | null
    lowest: { date: string; revenuePerLaborHour: number; revenue: number; hours: number } | null
  }[] = []

  for (const [lid, { name, days }] of byLoc) {
    const scored = days
      .map((d) => ({
        date: d.date,
        revenue: d.revenue,
        hours: d.hours,
        revenuePerLaborHour: d.hours > 0 ? d.revenue / d.hours : d.revenue > 0 ? Number.POSITIVE_INFINITY : 0,
      }))
      .filter((d) => d.hours > 0 || d.revenue > 0)

    const finite = scored.filter((d) => d.hours > 0 && Number.isFinite(d.revenuePerLaborHour))
    let highest: (typeof finite)[0] | null = null
    let lowest: (typeof finite)[0] | null = null
    for (const d of finite) {
      if (!highest || d.revenuePerLaborHour > highest.revenuePerLaborHour) highest = d
      if (!lowest || d.revenuePerLaborHour < lowest.revenuePerLaborHour) lowest = d
    }

    out.push({
      locationId: lid,
      locationName: name,
      highest: highest
        ? {
            date: highest.date,
            revenuePerLaborHour: Math.round(highest.revenuePerLaborHour * 100) / 100,
            revenue: Math.round(highest.revenue * 100) / 100,
            hours: Math.round(highest.hours * 100) / 100,
          }
        : null,
      lowest: lowest
        ? {
            date: lowest.date,
            revenuePerLaborHour: Math.round(lowest.revenuePerLaborHour * 100) / 100,
            revenue: Math.round(lowest.revenue * 100) / 100,
            hours: Math.round(lowest.hours * 100) / 100,
          }
        : null,
    })
  }

  out.sort((a, b) => a.locationName.localeCompare(b.locationName))
  return out
}

export async function inventoryCollections(db: Db, ctx: DailyOpsMetricsContext) {
  const notes: string[] = []
  const cron = await db.collection('bork_sales_by_cron').countDocuments(borkCronMatch(ctx), { limit: 1 })
  const hours = await db.collection('bork_sales_by_hour').countDocuments(borkCronMatch(ctx), { limit: 1 })
  const eitje = await db.collection('eitje_time_registration_aggregation').countDocuments(eitjeAggMatch(ctx), { limit: 1 })
  if (cron === 0) notes.push('No rows in bork_sales_by_cron for this range — run Bork sync/rebuild aggregations.')
  if (hours === 0) notes.push('No rows in bork_sales_by_hour for this range.')
  if (eitje === 0) notes.push('No rows in eitje_time_registration_aggregation for this range — rebuild Eitje aggregation.')
  notes.push('Food vs drinks uses a name-pattern heuristic on `bork_sales_by_hour.products` (from Bork rebuild); tune DRINK_NAME_PATTERN as needed.')
  notes.push('Hour-level labor cost uses daily labor prorated by that day’s hourly revenue share.')
  if (ctx.locationId === undefined) {
    notes.push('All locations: labor productivity min/max merges revenue and hours only when both exist for the same location/day.')
  }
  return {
    hasBorkCronData: cron > 0,
    hasBorkHourData: hours > 0,
    hasEitjeAggData: eitje > 0,
    notes,
  }
}

export type LaborMetricsPipelineInput = {
  workersByTeamLocation: Awaited<ReturnType<typeof fetchWorkersByTeamLocation>>
  workersByTeamLocationByDayRaw: Awaited<ReturnType<typeof fetchWorkersByTeamLocationByDay>>
  hoursCostByContractType: Awaited<ReturnType<typeof fetchHoursCostByContractType>>
  contractTypeByDay: Awaited<ReturnType<typeof fetchHoursCostByContractTypeByDay>>
  productivityByLocationDay: Awaited<ReturnType<typeof fetchLaborProductivityByLocationDay>>
  inventory: Awaited<ReturnType<typeof inventoryCollections>>
  revMap: Map<string, number>
  revByDateLocation: Map<string, number>
  labMap: Awaited<ReturnType<typeof fetchLaborByDate>>
}

export async function fetchLaborMetricsPipelineInput(db: Db, ctx: DailyOpsMetricsContext): Promise<LaborMetricsPipelineInput> {
  const [
    workersByTeamLocation,
    workersByTeamLocationByDayRaw,
    hoursCostByContractType,
    contractTypeByDay,
    productivityByLocationDay,
    inventory,
    revMap,
    revByDateLocation,
    labMap,
  ] = await Promise.all([
    fetchWorkersByTeamLocation(db, ctx),
    fetchWorkersByTeamLocationByDay(db, ctx),
    fetchHoursCostByContractType(db, ctx),
    fetchHoursCostByContractTypeByDay(db, ctx),
    fetchLaborProductivityByLocationDay(db, ctx),
    inventoryCollections(db, ctx),
    fetchRevenueByDate(db, ctx),
    fetchRevenueByDateAndLocation(db, ctx),
    fetchLaborByDate(db, ctx),
  ])
  return {
    workersByTeamLocation,
    workersByTeamLocationByDayRaw,
    hoursCostByContractType,
    contractTypeByDay,
    productivityByLocationDay,
    inventory,
    revMap,
    revByDateLocation,
    labMap,
  }
}

export function assembleDailyOpsLaborMetricsDto(
  ctx: DailyOpsMetricsContext,
  input: LaborMetricsPipelineInput
): DailyOpsLaborMetricsDto {
  const {
    workersByTeamLocation,
    workersByTeamLocationByDayRaw,
    hoursCostByContractType,
    contractTypeByDay,
    productivityByLocationDay,
    inventory,
    revMap,
    revByDateLocation,
    labMap,
  } = input

  const locDayAgg = new Map<string, { hours: number; cost: number }>()
  for (const row of workersByTeamLocationByDayRaw) {
    const k = locationDayKey(row.date, row.locationId)
    let a = locDayAgg.get(k)
    if (!a) {
      a = { hours: 0, cost: 0 }
      locDayAgg.set(k, a)
    }
    a.hours += row.totalHours
    a.cost += row.totalCost
  }

  const workersByTeamLocationByDay = workersByTeamLocationByDayRaw.map((row) => {
    const k = locationDayKey(row.date, row.locationId)
    const rev = revByDateLocation.get(k) ?? 0
    const agg = locDayAgg.get(k) ?? { hours: 0, cost: 0 }
    let attributedRev = 0
    if (rev > 0 && agg.hours > 0) {
      attributedRev = rev * (row.totalHours / agg.hours)
    }
    const laborCostPctOfRevenue =
      attributedRev > 0 ? Math.round((row.totalCost / attributedRev) * 100 * 10) / 10 : null
    return {
      ...row,
      laborCostPctOfRevenue,
    }
  })

  const locationLaborPctByDay: {
    date: string
    locationId: string
    laborCostPctOfRevenue: number | null
  }[] = []
  for (const [k, agg] of locDayAgg) {
    const { date, locationId } = parseLocationDayKey(k)
    const rev = revByDateLocation.get(k) ?? 0
    const laborCostPctOfRevenue =
      rev > 0 ? Math.round((agg.cost / rev) * 100 * 10) / 10 : null
    locationLaborPctByDay.push({ date, locationId, laborCostPctOfRevenue })
  }
  locationLaborPctByDay.sort(
    (a, b) => a.locationId.localeCompare(b.locationId) || a.date.localeCompare(b.date)
  )

  const days = enumerateUtcDatesInclusive(ctx.startDate, ctx.endDate)
  let sumRev = 0
  let sumLab = 0
  let sumHours = 0

  const daily: DailyOpsLaborDayDto[] = days.map((date) => {
    const revenue = revMap.get(date) ?? 0
    const lab = labMap.get(date)
    const laborCost = lab?.laborCost ?? 0
    const hours = lab?.hours ?? 0
    const distinctWorkerCount = lab?.distinctWorkerCount ?? 0
    sumRev += revenue
    sumLab += laborCost
    sumHours += hours
    const laborCostPctOfRevenue = revenue > 0 ? (laborCost / revenue) * 100 : null
    const revenuePerLaborHour = hours > 0 ? revenue / hours : null
    return {
      date,
      revenue: Math.round(revenue * 100) / 100,
      laborCost: Math.round(laborCost * 100) / 100,
      hours: Math.round(hours * 100) / 100,
      distinctWorkerCount,
      laborCostPctOfRevenue:
        laborCostPctOfRevenue != null ? Math.round(laborCostPctOfRevenue * 10) / 10 : null,
      revenuePerLaborHour:
        revenuePerLaborHour != null ? Math.round(revenuePerLaborHour * 100) / 100 : null,
    }
  })

  const periodRollup = {
    revenue: Math.round(sumRev * 100) / 100,
    laborCost: Math.round(sumLab * 100) / 100,
    hours: Math.round(sumHours * 100) / 100,
    laborCostPctOfRevenue:
      sumRev > 0 ? Math.round((sumLab / sumRev) * 100 * 10) / 10 : null,
    revenuePerLaborHour:
      sumHours > 0 ? Math.round((sumRev / sumHours) * 100) / 100 : null,
  }

  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    inventory: {
      hasBorkCronData: inventory.hasBorkCronData,
      hasBorkHourData: inventory.hasBorkHourData,
      hasEitjeAggData: inventory.hasEitjeAggData,
      notes: inventory.notes,
    },
    workersByTeamLocation,
    workersByTeamLocationByDay,
    locationLaborPctByDay,
    hoursCostByContractType,
    contractTypeByDay,
    daily,
    periodRollup,
    productivityByLocationDay,
  }
}

export function buildDailyOpsSummaryDto(
  ctx: DailyOpsMetricsContext,
  revMap: Map<string, number>,
  labMap: LaborMetricsPipelineInput['labMap']
): DailyOpsSummaryDto {
  let totalRevenue = 0
  for (const v of revMap.values()) totalRevenue += v
  let totalLaborCost = 0
  let totalLaborHours = 0
  for (const v of labMap.values()) {
    totalLaborCost += v.laborCost
    totalLaborHours += v.hours
  }
  const profit = totalRevenue - totalLaborCost
  const profitMarginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0
  const revenuePerLaborHour = totalLaborHours > 0 ? totalRevenue / totalLaborHours : null
  const laborCostPctOfRevenue = totalRevenue > 0 ? (totalLaborCost / totalRevenue) * 100 : null

  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalLaborCost: Math.round(totalLaborCost * 100) / 100,
      totalLaborHours: Math.round(totalLaborHours * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitMarginPct: Math.round(profitMarginPct * 10) / 10,
      revenuePerLaborHour:
        revenuePerLaborHour != null ? Math.round(revenuePerLaborHour * 100) / 100 : null,
      laborCostPctOfRevenue:
        laborCostPctOfRevenue != null ? Math.round(laborCostPctOfRevenue * 10) / 10 : null,
    },
    vatDisclaimer: VAT_DISCLAIMER,
  }
}

export function buildDailyOpsRevenueBreakdownDto(
  ctx: DailyOpsMetricsContext,
  cat: { drinks: number; food: number },
  hourBundle: BorkHourAggregatesBundle,
  revMap: Map<string, number>,
  labMap: LaborMetricsPipelineInput['labMap']
): DailyOpsRevenueBreakdownDto {
  const tp = revenueByTimePeriodFromHourTotals(hourBundle.byHourOnly)
  const best = computeMostProfitableHour(hourBundle.byDayHour, revMap, labMap)

  const revenueByCategory = [
    { key: 'drinks', label: 'Drinks', amount: Math.round(cat.drinks * 100) / 100 },
    { key: 'food', label: 'Food', amount: Math.round(cat.food * 100) / 100 },
  ]

  const revenueByTimePeriod: { key: string; label: string; amount: number }[] = [
    { key: 'lunch', label: 'Lunch', amount: Math.round(tp.lunch * 100) / 100 },
    { key: 'pre_drinks', label: 'Pre Drinks', amount: Math.round(tp.pre_drinks * 100) / 100 },
    { key: 'dinner', label: 'Dinner', amount: Math.round(tp.dinner * 100) / 100 },
    { key: 'after_drinks', label: 'After Drinks', amount: Math.round(tp.after_drinks * 100) / 100 },
  ]
  if (tp.other > 0) {
    revenueByTimePeriod.push({
      key: 'other',
      label: 'Other hours',
      amount: Math.round(tp.other * 100) / 100,
    })
  }

  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    revenueByCategory,
    revenueByTimePeriod,
    mostProfitableHour: {
      hourLabel: best.hourLabel,
      date: best.date,
      revenue: Math.round(best.revenue * 100) / 100,
      laborCost: Math.round(best.laborCost * 100) / 100,
      profit: Math.round(best.profit * 100) / 100,
    },
  }
}

export { VAT_DISCLAIMER }
