/**
 * Daily Ops dashboard: Bork revenue + Eitje labor aggregations (fast paths on prebuilt collections).
 */
import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import type { DailyOpsPeriodId } from '~/types/daily-ops-dashboard'

const VAT_DISCLAIMER = 'All revenue values shown are excluding VAT (ex VAT)'

const DRINK_NAME_PATTERN =
  /wine|wijn|beer|bier|gint|gin |vodka|whisk|whiskey|rum|cocktail|cola|sprite|fanta|coffee|koffie|thee|tea|sap|juice|fris|prosecco|champagne|cider|tonic|latte|cappuccino|espresso|pils|stelz|borrel|aperol|campari|martini|soda|limonade/i

export type DailyOpsMetricsContext = {
  period: DailyOpsPeriodId
  startDate: string
  endDate: string
  locationId: ObjectId | string | undefined
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

function isoDateToBorkYmdInt(iso: string): number {
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10))
  return y * 10000 + m * 100 + d
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

export async function fetchRevenueByCategoryFromRaw(db: Db, ctx: DailyOpsMetricsContext) {
  const startYmd = isoDateToBorkYmdInt(ctx.startDate)
  const endYmd = isoDateToBorkYmdInt(ctx.endDate)

  const rawMatch: Record<string, unknown> = { rawApiResponse: { $exists: true, $ne: null } }

  if (ctx.locationId !== undefined) {
    const maps = await db
      .collection('bork_unified_location_mapping')
      .find({ unifiedLocationId: ctx.locationId })
      .project({ borkLocationId: 1 })
      .toArray()
    const borkIds = maps.map((m) => m.borkLocationId).filter((id) => id != null)
    if (borkIds.length === 0) {
      return { drinks: 0, food: 0 }
    }
    rawMatch.locationId = { $in: borkIds }
  }

  const byCat = (await db
    .collection('bork_raw_data')
    .aggregate(
      [
        { $match: rawMatch },
        {
          $addFields: {
            _tickets: {
              $cond: {
                if: { $isArray: '$rawApiResponse' },
                then: '$rawApiResponse',
                else: {
                  $cond: {
                    if: { $ne: ['$rawApiResponse', null] },
                    then: ['$rawApiResponse'],
                    else: [],
                  },
                },
              },
            },
          },
        },
        { $unwind: { path: '$_tickets', preserveNullAndEmptyArrays: false } },
        { $unwind: { path: '$_tickets.Orders', preserveNullAndEmptyArrays: false } },
        {
          $addFields: {
            odRaw: { $ifNull: ['$_tickets.Orders.Date', '$_tickets.Orders.ActualDate'] },
          },
        },
        {
          $addFields: {
            orderYmd: {
              $convert: {
                input: {
                  $substrCP: [
                    { $concat: ['00000000', { $toString: { $ifNull: ['$odRaw', ''] } }] },
                    {
                      $subtract: [
                        { $strLenCP: { $concat: ['00000000', { $toString: { $ifNull: ['$odRaw', ''] } }] } },
                        8,
                      ],
                    },
                    8,
                  ],
                },
                to: 'int',
                onError: null,
                onNull: null,
              },
            },
          },
        },
        { $match: { orderYmd: { $gte: startYmd, $lte: endYmd } } },
        { $unwind: { path: '$_tickets.Orders.Lines', preserveNullAndEmptyArrays: false } },
        {
          $addFields: {
            productName: { $ifNull: ['$_tickets.Orders.Lines.ProductName', ''] },
            lineValue: {
              $multiply: [
                { $toDouble: { $ifNull: ['$_tickets.Orders.Lines.Price', 0] } },
                { $toDouble: { $ifNull: ['$_tickets.Orders.Lines.Qty', 0] } },
              ],
            },
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
      { allowDiskUse: true }
    )
    .toArray()) as { _id: string; amount: number }[]
  const drinks = byCat.find((x) => x._id === 'drinks')?.amount ?? 0
  const food = byCat.find((x) => x._id === 'food')?.amount ?? 0
  return { drinks, food }
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
        },
      },
    ])
    .toArray()) as { _id: string; laborCost: number; hours: number }[]

  return new Map(rows.map((r) => [r._id, { laborCost: r.laborCost, hours: r.hours }]))
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
  notes.push('Food vs drinks uses a name-pattern heuristic on Bork line ProductName; tune DRINK_NAME_PATTERN as needed.')
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

export { VAT_DISCLAIMER }
