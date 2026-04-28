import { getDb } from '../../../utils/db'
import {
  assembleDailyOpsLaborMetricsDto,
  buildDailyOpsRevenueBreakdownDto,
  buildDailyOpsSummaryDto,
  fetchHoursCostByContractType,
  fetchHoursCostByContractTypeByDay,
  fetchLaborByDate,
  fetchWorkersByTeamLocation,
  fetchWorkersByTeamLocationByDay,
  parseDailyOpsMetricsQuery,
} from '../../../utils/dailyOpsDashboardMetrics'
import { resolveBorkAggReadSuffix } from '../../../utils/borkAggVersionSuffix'
import type { DailyOpsMetricsContext } from '../../../utils/dailyOpsDashboardMetrics'
import type {
  DailyOpsLaborMetricsDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
} from '~/types/daily-ops-dashboard'

type DailyOpsDashboardBundleDto = {
  summary: DailyOpsSummaryDto
  revenue: DailyOpsRevenueBreakdownDto
  labor: DailyOpsLaborMetricsDto
}

function borkDayMatch(ctx: DailyOpsMetricsContext): Record<string, unknown> {
  const q: Record<string, unknown> = {
    business_date: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId !== undefined) q.locationId = ctx.locationId
  return q
}

async function fetchV2RevenueByDate(db: Awaited<ReturnType<typeof getDb>>, ctx: DailyOpsMetricsContext, suffix: string) {
  const rows = (await db
    .collection(`bork_business_days${suffix}`)
    .aggregate([
      { $match: borkDayMatch(ctx) },
      { $group: { _id: '$business_date', revenue: { $sum: { $ifNull: ['$total_revenue', 0] } } } },
    ])
    .toArray()) as { _id: string; revenue: number }[]
  return new Map(rows.map((r) => [r._id, r.revenue]))
}

async function fetchV2RevenueByDateAndLocation(
  db: Awaited<ReturnType<typeof getDb>>,
  ctx: DailyOpsMetricsContext,
  suffix: string
) {
  const rows = (await db
    .collection(`bork_business_days${suffix}`)
    .aggregate([
      { $match: borkDayMatch(ctx) },
      {
        $group: {
          _id: { date: '$business_date', locationId: '$locationId' },
          revenue: { $sum: { $ifNull: ['$total_revenue', 0] } },
        },
      },
    ])
    .toArray()) as { _id: { date: string; locationId: unknown }; revenue: number }[]
  const map = new Map<string, number>()
  for (const r of rows) map.set(`${r._id.date}\x1f${String(r._id.locationId ?? 'unknown')}`, r.revenue)
  return map
}

async function fetchV2RevenueByCategory(
  db: Awaited<ReturnType<typeof getDb>>,
  ctx: DailyOpsMetricsContext,
  suffix: string
) {
  const DRINK_NAME_PATTERN =
    /wine|wijn|beer|bier|gint|gin |vodka|whisk|whiskey|rum|cocktail|cola|sprite|fanta|coffee|koffie|thee|tea|sap|juice|fris|prosecco|champagne|cider|tonic|latte|cappuccino|espresso|pils|stelz|borrel|aperol|campari|martini|soda|limonade/i
  const [facetRow] = (await db
    .collection(`bork_sales_by_hour${suffix}`)
    .aggregate([
      { $match: borkDayMatch(ctx) },
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
          hourRevenueTotal: [{ $group: { _id: null, total: { $sum: { $ifNull: ['$total_revenue', 0] } } } }],
          productLinesTotal: [
            { $unwind: { path: '$products', preserveNullAndEmptyArrays: false } },
            { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ['$products.revenue', 0] } } } } },
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
  food += Math.max(0, hourGrand - lineGrand)
  return { drinks, food }
}

async function fetchV2HourBundle(db: Awaited<ReturnType<typeof getDb>>, ctx: DailyOpsMetricsContext, suffix: string) {
  const [row] = (await db
    .collection(`bork_sales_by_hour${suffix}`)
    .aggregate([
      { $match: borkDayMatch(ctx) },
      {
        $facet: {
          byHourOnly: [{ $group: { _id: '$business_hour', amount: { $sum: { $ifNull: ['$total_revenue', 0] } } } }],
          byDayHour: [{ $group: { _id: { d: '$business_date', h: '$business_hour' }, revenue: { $sum: { $ifNull: ['$total_revenue', 0] } } } }],
        },
      },
    ])
    .toArray()) as { byHourOnly: { _id: number; amount: number }[]; byDayHour: { _id: { d: string; h: number }; revenue: number }[] }[]
  return { byHourOnly: row?.byHourOnly ?? [], byDayHour: row?.byDayHour ?? [] }
}

async function fetchV2Inventory(db: Awaited<ReturnType<typeof getDb>>, ctx: DailyOpsMetricsContext, suffix: string) {
  const notes: string[] = []
  const q = borkDayMatch(ctx)
  const days = await db.collection(`bork_business_days${suffix}`).countDocuments(q, { limit: 1 })
  const hours = await db.collection(`bork_sales_by_hour${suffix}`).countDocuments(q, { limit: 1 })
  const eitje = await db.collection('eitje_time_registration_aggregation').countDocuments(
    { period_type: 'day', period: { $gte: ctx.startDate, $lte: ctx.endDate }, ...(ctx.locationId !== undefined ? { locationId: ctx.locationId } : {}) },
    { limit: 1 }
  )
  if (days === 0) notes.push(`No rows in bork_business_days${suffix} for this range.`)
  if (hours === 0) notes.push(`No rows in bork_sales_by_hour${suffix} for this range.`)
  if (eitje === 0) notes.push('No rows in eitje_time_registration_aggregation for this range.')
  return { hasBorkCronData: days > 0, hasBorkHourData: hours > 0, hasEitjeAggData: eitje > 0, notes }
}

async function fetchV2ProductivityByLocationDay(
  db: Awaited<ReturnType<typeof getDb>>,
  borkCtx: DailyOpsMetricsContext,
  laborCtx: DailyOpsMetricsContext,
  suffix: string
) {
  const revRows = (await db
    .collection(`bork_business_days${suffix}`)
    .aggregate([
      { $match: borkDayMatch(borkCtx) },
      { $group: { _id: { date: '$business_date', locationId: '$locationId', locationName: '$locationName' }, revenue: { $sum: { $ifNull: ['$total_revenue', 0] } } } },
    ])
    .toArray()) as { _id: { date: string; locationId: unknown; locationName?: string }; revenue: number }[]

  const labRows = (await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      { $match: { period_type: 'day', period: { $gte: laborCtx.startDate, $lte: laborCtx.endDate }, ...(laborCtx.locationId !== undefined ? { locationId: laborCtx.locationId } : {}) } },
      { $group: { _id: { period: '$period', locationId: '$locationId', location_name: '$location_name' }, hours: { $sum: { $ifNull: ['$total_hours', 0] } }, laborCost: { $sum: { $ifNull: ['$total_cost', 0] } } } },
    ])
    .toArray()) as { _id: { period: string; locationId: unknown; location_name?: string }; hours: number; laborCost: number }[]

  type DayLoc = { date: string; revenuePerLaborHour: number; revenue: number; hours: number }
  const byLoc = new Map<string, { name: string; days: DayLoc[] }>()
  const locKey = (id: unknown) => (id != null ? String(id) : 'unknown')

  for (const r of revRows) {
    const lk = locKey(r._id.locationId)
    if (!byLoc.has(lk)) byLoc.set(lk, { name: r._id.locationName ?? lk, days: [] })
    const entry = byLoc.get(lk)!
    let d = entry.days.find((x) => x.date === r._id.date)
    if (!d) {
      d = { date: r._id.date, revenuePerLaborHour: 0, revenue: 0, hours: 0 }
      entry.days.push(d)
    }
    d.revenue += r.revenue
  }
  for (const r of labRows) {
    const lk = locKey(r._id.locationId)
    if (!byLoc.has(lk)) byLoc.set(lk, { name: r._id.location_name ?? lk, days: [] })
    const entry = byLoc.get(lk)!
    let d = entry.days.find((x) => x.date === r._id.period)
    if (!d) {
      d = { date: r._id.period, revenuePerLaborHour: 0, revenue: 0, hours: 0 }
      entry.days.push(d)
    }
    d.hours += r.hours
  }

  const out: { locationId: string; locationName: string; highest: DayLoc | null; lowest: DayLoc | null }[] = []
  for (const [lid, { name, days }] of byLoc) {
    const finite = days
      .map((d) => ({ ...d, revenuePerLaborHour: d.hours > 0 ? d.revenue / d.hours : 0 }))
      .filter((d) => d.hours > 0 || d.revenue > 0)
    let highest: (typeof finite)[0] | null = null
    let lowest: (typeof finite)[0] | null = null
    for (const d of finite) {
      if (!highest || d.revenuePerLaborHour > highest.revenuePerLaborHour) highest = d
      if (!lowest || d.revenuePerLaborHour < lowest.revenuePerLaborHour) lowest = d
    }
    out.push({ locationId: lid, locationName: name, highest, lowest })
  }
  out.sort((a, b) => a.locationName.localeCompare(b.locationName))
  return out
}

export default defineEventHandler(async (event): Promise<DailyOpsDashboardBundleDto> => {
  setResponseHeader(event, 'Cache-Control', 'private, max-age=30, stale-while-revalidate=120')
  const baseCtx = parseDailyOpsMetricsQuery(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  const suffix = resolveBorkAggReadSuffix()

  // Keep unified location for Bork V2, resolve Eitje-only location for labor queries.
  const borkCtx = { ...baseCtx }
  const laborCtx = { ...baseCtx }
  if (baseCtx.locationId && typeof baseCtx.locationId !== 'string') {
    const unifiedDoc = await db.collection('unified_location').findOne({ _id: baseCtx.locationId })
    if (unifiedDoc?.eitjeIds?.[0] != null) laborCtx.locationId = String(unifiedDoc.eitjeIds[0])
  }

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
    cat,
    hourBundle,
  ] = await Promise.all([
    fetchWorkersByTeamLocation(db, laborCtx),
    fetchWorkersByTeamLocationByDay(db, laborCtx),
    fetchHoursCostByContractType(db, laborCtx),
    fetchHoursCostByContractTypeByDay(db, laborCtx),
    fetchV2ProductivityByLocationDay(db, borkCtx, laborCtx, suffix),
    fetchV2Inventory(db, borkCtx, suffix),
    fetchV2RevenueByDate(db, borkCtx, suffix),
    fetchV2RevenueByDateAndLocation(db, borkCtx, suffix),
    fetchLaborByDate(db, laborCtx),
    fetchV2RevenueByCategory(db, borkCtx, suffix),
    fetchV2HourBundle(db, borkCtx, suffix),
  ])

  const summary = buildDailyOpsSummaryDto(borkCtx, revMap, labMap)
  const revenue = buildDailyOpsRevenueBreakdownDto(borkCtx, cat, hourBundle, revMap, labMap)
  const labor = assembleDailyOpsLaborMetricsDto(borkCtx, {
    workersByTeamLocation,
    workersByTeamLocationByDayRaw,
    hoursCostByContractType,
    contractTypeByDay,
    productivityByLocationDay,
    inventory,
    revMap,
    revByDateLocation,
    labMap,
  })

  return { summary, revenue, labor }
})
