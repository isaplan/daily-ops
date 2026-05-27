/**
 * @registry-id: dailyOpsSnapshotFetchDashboardBundle
 * @created: 2026-05-25T00:00:00.000Z
 * @last-modified: 2026-05-26T02:36:00.000Z
 * @description: Snapshot-first Daily Ops dashboard bundle (ADR-004). One parallel read per section collection; no bork_* on GET.
 * @last-fix: [2026-05-26] Add snapshot-backed revenue drilldown section below Most Profitable Hour.
 *   Prior: [2026-05-26] Today hourly detail reads dedicated revenue-by-order-time snapshot section.
 *   Prior: [2026-05-26] Today hourly detail includes order-time buckets when snapshots provide them.
 *   Prior: [2026-05-26] Today headline/interval revenue uses snapshot selected total when borkTotals is zero.
 * @adr-ref: ADR-004
 *
 * @architecture:
 *   - Writers: dailyOpsSnapshotService (cron + rebuild).
 *   - Readers: GET /api/daily-ops/metrics/bundle (+ slice routes delegate here).
 *   - Missing sealed rows → dataGap flags + zeros; today hourly labor may use local Eitje shift rows while snapshots catch up.
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 * ✓ server/api/daily-ops/metrics/summary.get.ts
 * ✓ server/api/daily-ops/metrics/labor.get.ts
 * ✓ server/api/daily-ops/metrics/revenue-breakdown.get.ts
 */

import type { Db } from 'mongodb'
import {
  DAILY_OPS_SNAPSHOT_COLLECTIONS,
  type DailyOpsSnapshotLaborSection,
  type DailyOpsSnapshotMaster,
  type DailyOpsSnapshotRevenueByOrderTimeSection,
  type DailyOpsSnapshotRevenueHourlySection,
  type DailyOpsSnapshotRevenueProductsSection,
  type DailyOpsSnapshotRevenueSection,
  type DailyOpsSnapshotRevenueTablesSection,
  type DailyOpsSnapshotRevenueWorkersSection,
} from '~/types/daily-ops-snapshot'
import type {
  DailyOpsHourlyRevenueRowDto,
  DailyOpsLaborDayDto,
  DailyOpsLaborMetricsDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
} from '~/types/daily-ops-dashboard'
import { rollupFoodBeverageFromCategories } from '../borkFoodBeverageSplit'
import {
  buildDailyOpsRevenueBreakdownDto,
  buildDailyOpsSummaryDto,
  enumerateUtcDatesInclusive,
  fetchBorkHourAggregatesBundleWithLocations,
  fetchHoursCostByContractType,
  fetchHoursCostByContractTypeByDay,
  type BorkHourAggregatesBundle,
  type DailyOpsMetricsContext,
} from '../dailyOpsDashboardMetrics'
import {
  fetchLaborByBusinessDateHour,
  type LaborByBusinessDateHourBucket,
} from '../eitjeLaborByHour'
import { VENUE_STRIP_LOCATIONS } from '../dailyOpsVenueStrip'
import { resolveDailyOpsHeadlineRevenue } from '../dailyOpsHeadlineRevenue'
import { aggregateLaborForRange } from './aggregateLaborForRange'
import { buildProfitByIntervalFromSnapshotHourly } from './buildProfitByIntervalFromSnapshot'
import { buildRevenueDrilldownSection } from './buildRevenueDrilldownSection'

export type DailyOpsDashboardBundleDto = {
  summary: DailyOpsSummaryDto
  revenue: DailyOpsRevenueBreakdownDto
  labor: DailyOpsLaborMetricsDto
}

type SnapshotDashboardRows = {
  masters: DailyOpsSnapshotMaster[]
  revenue: DailyOpsSnapshotRevenueSection[]
  labor: DailyOpsSnapshotLaborSection[]
  hourly: DailyOpsSnapshotRevenueHourlySection[]
  orderTime: DailyOpsSnapshotRevenueByOrderTimeSection[]
  products: DailyOpsSnapshotRevenueProductsSection[]
  tables: DailyOpsSnapshotRevenueTablesSection[]
  workers: DailyOpsSnapshotRevenueWorkersSection[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function rangeFilter(ctx: DailyOpsMetricsContext): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId
  return filter
}

async function loadSnapshotDashboardRows(db: Db, ctx: DailyOpsMetricsContext): Promise<SnapshotDashboardRows> {
  const filter = rangeFilter(ctx)
  const [masters, revenue, labor, hourly, orderTime, products, tables, workers] = await Promise.all([
    db.collection<DailyOpsSnapshotMaster>(DAILY_OPS_SNAPSHOT_COLLECTIONS.master).find(filter).toArray(),
    db.collection<DailyOpsSnapshotRevenueSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection).find(filter).toArray(),
    db.collection<DailyOpsSnapshotLaborSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection).find(filter).toArray(),
    db
      .collection<DailyOpsSnapshotRevenueHourlySection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueHourlySection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueByOrderTimeSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueByOrderTimeSection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueProductsSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueTablesSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueTablesSection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueWorkersSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueWorkersSection)
      .find(filter)
      .toArray(),
  ])
  return { masters, revenue, labor, hourly, orderTime, products, tables, workers }
}

function locDayKey(date: string, locationId: string): string {
  return `${date}|${locationId}`
}

/** Master fills gaps when section docs are missing (any period / location filter). */
function buildRevLabMaps(
  masters: DailyOpsSnapshotMaster[],
  revenue: DailyOpsSnapshotRevenueSection[],
  labor: DailyOpsSnapshotLaborSection[],
): {
  revMap: Map<string, number>
  labMap: Map<string, { laborCost: number; hours: number; distinctWorkerCount: number }>
  revByDateLocation: Map<string, number>
} {
  const revByDateLocation = new Map<string, number>()
  const labByLocDay = new Map<string, { laborCost: number; hours: number; workerIds: Set<string> }>()

  for (const r of revenue) {
    const ex = Number(r.totals?.ex_vat ?? 0)
    revByDateLocation.set(locDayKey(r.businessDate, r.locationId), ex)
  }
  for (const m of masters) {
    const key = locDayKey(m.businessDate, m.locationId)
    if (!revByDateLocation.has(key)) {
      revByDateLocation.set(key, Number(m.cards?.revenue?.ex_vat ?? 0))
    }
  }

  for (const l of labor) {
    const key = locDayKey(l.businessDate, l.locationId)
    const workerIds = new Set((l.workers ?? []).map((w) => w.userId).filter(Boolean))
    labByLocDay.set(key, {
      laborCost: Number(l.totals?.loaded_cost ?? 0),
      hours: Number(l.totals?.hours ?? 0),
      workerIds,
    })
  }
  for (const m of masters) {
    const key = locDayKey(m.businessDate, m.locationId)
    if (!labByLocDay.has(key)) {
      labByLocDay.set(key, {
        laborCost: Number(m.cards?.labor?.loaded_cost ?? 0),
        hours: Number(m.cards?.labor?.hours ?? 0),
        workerIds: new Set(),
      })
    }
  }

  const revMap = new Map<string, number>()
  for (const [key, amount] of revByDateLocation) {
    const day = key.split('|')[0] ?? key
    revMap.set(day, (revMap.get(day) ?? 0) + amount)
  }

  const labMap = new Map<string, { laborCost: number; hours: number; distinctWorkerCount: number }>()
  for (const [key, lab] of labByLocDay) {
    const day = key.split('|')[0] ?? key
    const prev = labMap.get(day)
    if (prev) {
      labMap.set(day, {
        laborCost: prev.laborCost + lab.laborCost,
        hours: prev.hours + lab.hours,
        distinctWorkerCount: prev.distinctWorkerCount + lab.workerIds.size,
      })
    } else {
      labMap.set(day, {
        laborCost: lab.laborCost,
        hours: lab.hours,
        distinctWorkerCount: lab.workerIds.size,
      })
    }
  }

  return { revMap, labMap, revByDateLocation }
}

function buildHourBundleFromSnapshots(
  hourly: DailyOpsSnapshotRevenueHourlySection[],
  revenue: DailyOpsSnapshotRevenueSection[],
): {
  byHourOnly: { _id: number; amount: number }[]
  byDayHour: { _id: { d: string; h: number; loc: string }; revenue: number }[]
} {
  const hourOnly = new Map<number, number>()
  const byDayHour: { _id: { d: string; h: number; loc: string }; revenue: number }[] = []

  const ingestHourly = (
    businessDate: string,
    locationId: string,
    slots: DailyOpsSnapshotRevenueSection['hourly'],
  ) => {
    for (const slot of slots ?? []) {
      const h = Number(slot.calendar_hour)
      const rev = Number(slot.revenue?.ex_vat ?? 0)
      if (rev <= 0) continue
      hourOnly.set(h, (hourOnly.get(h) ?? 0) + rev)
      byDayHour.push({ _id: { d: businessDate, h, loc: locationId }, revenue: rev })
    }
  }

  for (const doc of hourly) ingestHourly(doc.businessDate, doc.locationId, doc.hourly)
  for (const doc of revenue) {
    if (hourly.some((h) => h.businessDate === doc.businessDate && h.locationId === doc.locationId)) continue
    ingestHourly(doc.businessDate, doc.locationId, doc.hourly)
  }

  return {
    byHourOnly: [...hourOnly.entries()].map(([_id, amount]) => ({ _id, amount })),
    byDayHour,
  }
}

function snapshotHourBundleHasRevenue(bundle: BorkHourAggregatesBundle): boolean {
  return bundle.byDayHour.some((r) => r.revenue > 0)
}

/** Fill profit-by-interval / time-period when revenue sections were built without Bork suffix hourly. */
async function resolveHourBundleForDashboard(
  db: Db,
  ctx: DailyOpsMetricsContext,
  rows: SnapshotDashboardRows,
): Promise<BorkHourAggregatesBundle> {
  const fromSnapshot = buildHourBundleFromSnapshots(rows.hourly, rows.revenue)
  if (snapshotHourBundleHasRevenue(fromSnapshot)) return fromSnapshot
  return fetchBorkHourAggregatesBundleWithLocations(db, ctx)
}

function categoryTotalsFromProducts(products: DailyOpsSnapshotRevenueProductsSection[]): {
  food: number
  drinks: number
} {
  let food = 0
  let drinks = 0
  for (const doc of products) {
    const split = rollupFoodBeverageFromCategories(
      (doc.categories ?? []).map((c) => ({ name: c.name, revenue_ex_vat: c.revenue_ex_vat })),
    )
    food += split.food
    drinks += split.beverage
  }
  return { food: round2(food), drinks: round2(drinks) }
}

function buildHeadlineRevenueByLocDay(
  ctx: DailyOpsMetricsContext,
  revenue: DailyOpsSnapshotRevenueSection[],
  products: DailyOpsSnapshotRevenueProductsSection[],
): Map<string, number> {
  const productByLocDay = new Map(products.map((p) => [locDayKey(p.businessDate, p.locationId), p]))
  const out = new Map<string, number>()

  for (const rev of revenue) {
    const key = locDayKey(rev.businessDate, rev.locationId)
    const productDoc = productByLocDay.get(key)
    const split = rollupFoodBeverageFromCategories(
      (productDoc?.categories ?? []).map((c) => ({ name: c.name, revenue_ex_vat: c.revenue_ex_vat })),
    )
    const inboxExVat =
      rev.leadSource === 'inbox' && Number(rev.totals?.ex_vat ?? 0) > 0
        ? Number(rev.totals.ex_vat)
        : null
    out.set(
      key,
      resolveDailyOpsHeadlineRevenue(ctx, {
        snapshotExVat: Number(rev.totals?.ex_vat ?? 0),
        apiDayTotal: Number(rev.borkTotals?.ex_vat ?? 0),
        inboxExVat,
        categoryTotal: split.food + split.beverage,
      }),
    )
  }

  return out
}

/** Sum per-location labor buckets into `date|hour` keys for most-profitable-hour. */
function aggregateLaborByDateHour(laborByLocHour: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>()
  for (const [key, cost] of laborByLocHour) {
    const parts = key.split('|')
    if (parts.length < 2) continue
    const hourKey = parts.length >= 3 ? `${parts[1]}|${parts[2]}` : key
    out.set(hourKey, round2((out.get(hourKey) ?? 0) + cost))
  }
  return out
}

function laborCostMapFromHourly(
  laborByLocHour: Map<string, LaborByBusinessDateHourBucket>,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const [key, row] of laborByLocHour) out.set(key, row.loadedCost)
  return out
}

function laborByLocHourFromSnapshots(
  labor: DailyOpsSnapshotLaborSection[],
): Map<string, LaborByBusinessDateHourBucket> {
  const out = new Map<string, LaborByBusinessDateHourBucket>()
  for (const doc of labor) {
    for (const slot of doc.hourly ?? []) {
      const h = Number(slot.calendar_hour)
      if (!Number.isFinite(h)) continue
      const key = `${doc.locationId}|${doc.businessDate}|${h}`
      const prev = out.get(key) ?? { loadedCost: 0, hours: 0 }
      out.set(key, {
        loadedCost: round2(prev.loadedCost + Number(slot.loaded_cost ?? 0)),
        hours: round2(prev.hours + Number(slot.hours ?? 0)),
      })
    }
  }
  return out
}

function laborMapHours(map: Map<string, LaborByBusinessDateHourBucket>): number {
  let hours = 0
  for (const row of map.values()) hours += Number(row.hours ?? 0)
  return round2(hours)
}

function snapshotLaborTotalHours(labor: DailyOpsSnapshotLaborSection[]): number {
  return round2(labor.reduce((sum, doc) => sum + Number(doc.totals?.hours ?? 0), 0))
}

async function resolveLaborByLocHourForDashboard(
  db: Db,
  ctx: DailyOpsMetricsContext,
  labor: DailyOpsSnapshotLaborSection[],
): Promise<Map<string, LaborByBusinessDateHourBucket>> {
  const fromSnapshot = laborByLocHourFromSnapshots(labor)
  if (ctx.period !== 'today' || ctx.startDate !== ctx.endDate) return fromSnapshot

  const hourlyHours = laborMapHours(fromSnapshot)
  const totalHours = snapshotLaborTotalHours(labor)
  if (hourlyHours > 0 && (totalHours <= 0 || hourlyHours >= totalHours * 0.95)) return fromSnapshot

  const live = await fetchLaborByBusinessDateHour(
    db,
    { startDate: ctx.startDate, endDate: ctx.endDate, locationId: ctx.locationId },
    { perLocation: true },
  )
  return live.size > 0 ? live : fromSnapshot
}

function laborBucketForLocationHour(
  laborByLocHour: Map<string, LaborByBusinessDateHourBucket>,
  locationId: string,
  date: string,
  hour: number,
): LaborByBusinessDateHourBucket {
  return laborByLocHour.get(`${locationId}|${date}|${hour}`) ?? { loadedCost: 0, hours: 0 }
}

function buildHourlyRevenueRows(
  dateStr: string,
  revenueByHour: Map<number, number>,
  revenueByLocationHour: Map<string, number>,
  laborByLocHour: Map<string, LaborByBusinessDateHourBucket>,
): DailyOpsHourlyRevenueRowDto[] {
  const laborHoursByHour = new Map<number, number>()
  for (const [key, row] of laborByLocHour) {
    const parts = key.split('|')
    const date = parts.length >= 3 ? parts[1] : parts[0]
    const hour = Number(parts.length >= 3 ? parts[2] : parts[1])
    if (date !== dateStr || !Number.isFinite(hour) || row.hours <= 0) continue
    laborHoursByHour.set(hour, round2((laborHoursByHour.get(hour) ?? 0) + row.hours))
  }

  return [...revenueByHour.entries()]
    .map(([calendarHour, revenue]) => {
      const laborHours = round2(laborHoursByHour.get(calendarHour) ?? 0)
      return {
        calendarHour,
        revenue: round2(revenue),
        laborHours,
        revenuePerLaborHour: laborHours > 0 ? round2(revenue / laborHours) : null,
        locations: VENUE_STRIP_LOCATIONS.map((location) => {
          const locationRevenue = round2(revenueByLocationHour.get(`${location.locationId}|${calendarHour}`) ?? 0)
          const locationLabor = laborBucketForLocationHour(
            laborByLocHour,
            location.locationId,
            dateStr,
            calendarHour,
          )
          const laborHours = round2(locationLabor.hours)
          return {
            locationId: location.locationId,
            locationName: location.locationName,
            revenue: locationRevenue,
            laborHours,
            revenuePerLaborHour: laborHours > 0 ? round2(locationRevenue / laborHours) : null,
          }
        }),
      }
    })
    .sort((a, b) => a.calendarHour - b.calendarHour)
}

function buildTodayExtrasFromHourBundle(
  ctx: DailyOpsMetricsContext,
  hourBundle: BorkHourAggregatesBundle,
  revenue: DailyOpsSnapshotRevenueSection[],
  orderTime: DailyOpsSnapshotRevenueByOrderTimeSection[],
  laborByLocHour: Map<string, LaborByBusinessDateHourBucket>,
): DailyOpsRevenueBreakdownDto['todayRevenueDetail'] {
  const apiHourly = new Map<number, number>()
  const apiHourlyByLocation = new Map<string, number>()
  const orderHourly = new Map<number, number>()
  const orderHourlyByLocation = new Map<string, number>()
  const dateStr = ctx.startDate

  for (const row of hourBundle.byDayHour) {
    if (row._id.d !== dateStr) continue
    const h = Number(row._id.h)
    if (row.revenue <= 0) continue
    apiHourly.set(h, (apiHourly.get(h) ?? 0) + row.revenue)
    if (row._id.loc) {
      const locHourKey = `${row._id.loc}|${h}`
      apiHourlyByLocation.set(locHourKey, (apiHourlyByLocation.get(locHourKey) ?? 0) + row.revenue)
    }
  }
  if (apiHourly.size === 0) {
    for (const row of hourBundle.byHourOnly) {
      if (row.amount <= 0) continue
      apiHourly.set(Number(row._id), (apiHourly.get(Number(row._id)) ?? 0) + row.amount)
    }
  }
  for (const doc of orderTime) {
    if (doc.businessDate !== dateStr) continue
    for (const slot of doc.hourly ?? []) {
      const h = Number(slot.calendar_hour)
      const rev = Number(slot.revenue?.ex_vat ?? 0)
      if (!Number.isFinite(h) || rev <= 0) continue
      orderHourly.set(h, (orderHourly.get(h) ?? 0) + rev)
      orderHourlyByLocation.set(`${doc.locationId}|${h}`, (orderHourlyByLocation.get(`${doc.locationId}|${h}`) ?? 0) + rev)
    }
  }
  if (orderHourly.size === 0) {
    for (const doc of revenue) {
      if (doc.businessDate !== dateStr) continue
      for (const slot of doc.orderHourly ?? []) {
        const h = Number(slot.calendar_hour)
        const rev = Number(slot.revenue?.ex_vat ?? 0)
        if (!Number.isFinite(h) || rev <= 0) continue
        orderHourly.set(h, (orderHourly.get(h) ?? 0) + rev)
        orderHourlyByLocation.set(`${doc.locationId}|${h}`, (orderHourlyByLocation.get(`${doc.locationId}|${h}`) ?? 0) + rev)
      }
    }
  }

  const inboxSnaps: NonNullable<DailyOpsRevenueBreakdownDto['todayRevenueDetail']>['inboxBasisCronSnapshots'] = []
  for (const doc of revenue) {
    for (const intr of doc.intraday ?? []) {
      const cronHour = Number(intr.cron_hour)
      if (cronHour !== 15 && cronHour !== 23) continue
      inboxSnaps.push({
        cronHour,
        finalRevenueExVat: round2(Number(intr.revenue_ex_vat ?? 0)),
        locationLabel: doc.locationName ?? doc.locationId,
      })
    }
  }

  if (apiHourly.size === 0 && orderHourly.size === 0 && inboxSnaps.length === 0) return undefined

  return {
    apiHourlyByCalendarHour: buildHourlyRevenueRows(dateStr, apiHourly, apiHourlyByLocation, laborByLocHour),
    orderHourlyByCalendarHour: buildHourlyRevenueRows(dateStr, orderHourly, orderHourlyByLocation, laborByLocHour),
    inboxBasisCronSnapshots: inboxSnaps,
  }
}

function contractRollupsFromSnapshotLabor(labor: DailyOpsSnapshotLaborSection[]): {
  hoursCostByContractType: DailyOpsLaborMetricsDto['hoursCostByContractType']
  contractTypeByDay: DailyOpsLaborMetricsDto['contractTypeByDay']
} {
  const periodMap = new Map<string, { hours: number; cost: number; workerIds: Set<string> }>()
  const dayMap = new Map<
    string,
    { date: string; contractType: string; hours: number; cost: number; workerIds: Set<string> }
  >()

  for (const doc of labor) {
    const ingest = (contractType: string, hours: number, loaded: number, userId?: string) => {
      const ct = contractType || '—'
      let p = periodMap.get(ct)
      if (!p) {
        p = { hours: 0, cost: 0, workerIds: new Set() }
        periodMap.set(ct, p)
      }
      p.hours += hours
      p.cost += loaded
      if (userId) p.workerIds.add(userId)

      const dayKey = `${doc.businessDate}|${ct}`
      let d = dayMap.get(dayKey)
      if (!d) {
        d = { date: doc.businessDate, contractType: ct, hours: 0, cost: 0, workerIds: new Set() }
        dayMap.set(dayKey, d)
      }
      d.hours += hours
      d.cost += loaded
      if (userId) d.workerIds.add(userId)
    }

    if (doc.contracts?.length) {
      for (const c of doc.contracts) {
        ingest(c.contractType, Number(c.hours ?? 0), Number(c.loaded_cost ?? 0))
      }
      continue
    }
    for (const w of doc.workers ?? []) {
      ingest(
        w.contractType ?? '—',
        Number(w.hours ?? 0),
        Number(w.loaded_cost ?? 0),
        w.userId,
      )
    }
  }

  const hoursCostByContractType = [...periodMap.entries()]
    .map(([contractType, v]) => ({
      contractType,
      totalHours: round2(v.hours),
      totalCost: round2(v.cost),
    }))
    .sort((a, b) => a.contractType.localeCompare(b.contractType))

  const contractTypeByDay = [...dayMap.values()]
    .map((d) => ({
      date: d.date,
      contractType: d.contractType,
      workerCount: d.workerIds.size,
      totalHours: round2(d.hours),
      totalCost: round2(d.cost),
    }))
    .sort((a, b) => a.contractType.localeCompare(b.contractType) || a.date.localeCompare(b.date))

  return { hoursCostByContractType, contractTypeByDay }
}

function assembleLaborFromSnapshots(
  ctx: DailyOpsMetricsContext,
  rows: SnapshotDashboardRows,
  revMap: Map<string, number>,
  labMap: Map<string, { laborCost: number; hours: number; distinctWorkerCount: number }>,
  revByDateLocation: Map<string, number>,
  contractWarm: {
    hoursCostByContractType: DailyOpsLaborMetricsDto['hoursCostByContractType']
    contractTypeByDay: DailyOpsLaborMetricsDto['contractTypeByDay']
  },
): DailyOpsLaborMetricsDto {
  const days = enumerateUtcDatesInclusive(ctx.startDate, ctx.endDate)
  const teamPeriod = new Map<
    string,
    {
      locationId: string
      locationName: string
      teamId: string
      teamName: string
      workerIds: Set<string>
      totalHours: number
      totalCost: number
    }
  >()
  const teamByDay: DailyOpsLaborMetricsDto['workersByTeamLocationByDay'] = []

  for (const doc of rows.labor) {
    for (const t of doc.teams ?? []) {
      const k = `${doc.locationId}|${t.teamId}`
      let agg = teamPeriod.get(k)
      if (!agg) {
        agg = {
          locationId: doc.locationId,
          locationName: doc.locationName,
          teamId: t.teamId,
          teamName: t.teamName,
          workerIds: new Set(),
          totalHours: 0,
          totalCost: 0,
        }
        teamPeriod.set(k, agg)
      }
      agg.totalHours += Number(t.hours ?? 0)
      agg.totalCost += Number(t.loaded_cost ?? 0)
    }
    for (const w of doc.workers ?? []) {
      const k = `${doc.locationId}|${w.teamId}`
      teamPeriod.get(k)?.workerIds.add(w.userId)
    }
    for (const t of doc.teams ?? []) {
      teamByDay.push({
        date: doc.businessDate,
        locationId: doc.locationId,
        locationName: doc.locationName,
        teamId: t.teamId,
        teamName: t.teamName,
        workerCount: (doc.workers ?? []).filter((w) => w.teamId === t.teamId).length,
        totalHours: round2(Number(t.hours ?? 0)),
        totalCost: round2(Number(t.loaded_cost ?? 0)),
        laborCostPctOfRevenue: null,
      })
    }
  }

  const workersByTeamLocation = [...teamPeriod.values()].map((a) => ({
    locationId: a.locationId,
    locationName: a.locationName,
    teamId: a.teamId,
    teamName: a.teamName,
    workerCount: a.workerIds.size,
    totalHours: round2(a.totalHours),
    totalCost: round2(a.totalCost),
  }))

  const locationDayKey = (date: string, locationId: string) => `${date}|${locationId}`
  const locDayAgg = new Map<string, { hours: number; cost: number }>()
  for (const row of teamByDay) {
    const k = locationDayKey(row.date, row.locationId)
    const a = locDayAgg.get(k) ?? { hours: 0, cost: 0 }
    a.hours += row.totalHours
    a.cost += row.totalCost
    locDayAgg.set(k, a)
  }

  const workersByTeamLocationByDay = teamByDay.map((row) => {
    const k = locationDayKey(row.date, row.locationId)
    const rev = revByDateLocation.get(k) ?? 0
    const agg = locDayAgg.get(k) ?? { hours: 0, cost: 0 }
    let attributedRev = 0
    if (rev > 0 && agg.hours > 0) attributedRev = rev * (row.totalHours / agg.hours)
    const laborCostPctOfRevenue =
      attributedRev > 0 ? Math.round((row.totalCost / attributedRev) * 100 * 10) / 10 : null
    return { ...row, laborCostPctOfRevenue }
  })

  const revenueByLocationDay: DailyOpsLaborMetricsDto['revenueByLocationDay'] = []
  for (const [k, revenue] of revByDateLocation) {
    const [date = '', locationId = ''] = k.split('|')
    revenueByLocationDay.push({ date, locationId, revenue: round2(revenue) })
  }
  revenueByLocationDay.sort((a, b) => a.locationId.localeCompare(b.locationId) || a.date.localeCompare(b.date))

  const locationLaborPctByDay: DailyOpsLaborMetricsDto['locationLaborPctByDay'] = []
  for (const [k, agg] of locDayAgg) {
    const [date = '', locationId = ''] = k.split('|')
    const rev = revByDateLocation.get(k) ?? 0
    locationLaborPctByDay.push({
      date,
      locationId,
      laborCostPctOfRevenue: rev > 0 ? Math.round((agg.cost / rev) * 100 * 10) / 10 : null,
    })
  }

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
    return {
      date,
      revenue: round2(revenue),
      laborCost: round2(laborCost),
      hours: round2(hours),
      distinctWorkerCount,
      laborCostPctOfRevenue: revenue > 0 ? Math.round((laborCost / revenue) * 100 * 10) / 10 : null,
      revenuePerLaborHour: hours > 0 ? round2(revenue / hours) : null,
    }
  })

  const productivityByLocationDay: DailyOpsLaborMetricsDto['productivityByLocationDay'] = []
  const byLoc = new Map<string, { locationName: string; rows: { date: string; rev: number; hours: number }[] }>()
  for (const doc of rows.labor) {
    const rev = revByDateLocation.get(`${doc.businessDate}|${doc.locationId}`) ?? 0
    const hours = Number(doc.totals?.hours ?? 0)
    let loc = byLoc.get(doc.locationId)
    if (!loc) {
      loc = { locationName: doc.locationName, rows: [] }
      byLoc.set(doc.locationId, loc)
    }
    loc.rows.push({ date: doc.businessDate, rev, hours })
  }
  for (const [locationId, loc] of byLoc) {
    const scored = loc.rows
      .filter((r) => r.hours > 0)
      .map((r) => ({
        date: r.date,
        revenue: round2(r.rev),
        hours: round2(r.hours),
        revenuePerLaborHour: round2(r.rev / r.hours),
      }))
    scored.sort((a, b) => b.revenuePerLaborHour - a.revenuePerLaborHour)
    productivityByLocationDay.push({
      locationId,
      locationName: loc.locationName,
      highest: scored[0]
        ? {
            date: scored[0].date,
            revenuePerLaborHour: scored[0].revenuePerLaborHour,
            revenue: scored[0].revenue,
            hours: scored[0].hours,
          }
        : null,
      lowest: scored.length > 1
        ? {
            date: scored[scored.length - 1]!.date,
            revenuePerLaborHour: scored[scored.length - 1]!.revenuePerLaborHour,
            revenue: scored[scored.length - 1]!.revenue,
            hours: scored[scored.length - 1]!.hours,
          }
        : null,
    })
  }

  const snapshotContracts = contractRollupsFromSnapshotLabor(rows.labor)
  const hoursCostByContractType =
    snapshotContracts.hoursCostByContractType.length > 0
      ? snapshotContracts.hoursCostByContractType
      : contractWarm.hoursCostByContractType
  const contractTypeByDay =
    snapshotContracts.contractTypeByDay.length > 0
      ? snapshotContracts.contractTypeByDay
      : contractWarm.contractTypeByDay

  return {
    range: { period: ctx.period, startDate: ctx.startDate, endDate: ctx.endDate },
    inventory: {
      hasBorkCronData: rows.revenue.some((r) => (r.intraday?.length ?? 0) > 0),
      hasBorkHourData: rows.hourly.length > 0 || rows.revenue.some((r) => (r.hourly?.length ?? 0) > 0),
      hasEitjeAggData: rows.labor.length > 0 || rows.masters.some((m) => m.sections?.labor),
      notes: ['Read from daily_ops_snapshot* (ADR-004).'],
    },
    workersByTeamLocation,
    workersByTeamLocationByDay,
    locationLaborPctByDay,
    revenueByLocationDay,
    hoursCostByContractType,
    contractTypeByDay,
    daily,
    periodRollup: {
      revenue: round2(sumRev),
      laborCost: round2(sumLab),
      hours: round2(sumHours),
      laborCostPctOfRevenue: sumRev > 0 ? Math.round((sumLab / sumRev) * 100 * 10) / 10 : null,
      revenuePerLaborHour: sumHours > 0 ? round2(sumRev / sumHours) : null,
    },
    productivityByLocationDay,
  }
}

/** Snapshot-only dashboard bundle — single coordinated read (ADR-004). */
export async function fetchDailyOpsDashboardBundle(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsDashboardBundleDto> {
  const rows = await loadSnapshotDashboardRows(db, ctx)
  const snapshotContracts = contractRollupsFromSnapshotLabor(rows.labor)

  let hoursCostByContractType = snapshotContracts.hoursCostByContractType
  let contractTypeByDay = snapshotContracts.contractTypeByDay
  if (hoursCostByContractType.length === 0 || contractTypeByDay.length === 0) {
    const [warmPeriod, warmDay] = await Promise.all([
      hoursCostByContractType.length === 0
        ? fetchHoursCostByContractType(db, ctx)
        : Promise.resolve([] as DailyOpsLaborMetricsDto['hoursCostByContractType']),
      contractTypeByDay.length === 0
        ? fetchHoursCostByContractTypeByDay(db, ctx)
        : Promise.resolve([] as DailyOpsLaborMetricsDto['contractTypeByDay']),
    ])
    if (hoursCostByContractType.length === 0) hoursCostByContractType = warmPeriod
    if (contractTypeByDay.length === 0) contractTypeByDay = warmDay
  }

  const { revMap, labMap, revByDateLocation } = buildRevLabMaps(rows.masters, rows.revenue, rows.labor)
  const cat = categoryTotalsFromProducts(rows.products)
  const hourBundle = await resolveHourBundleForDashboard(db, ctx, rows)
  const headlineRevenueByLocDay = buildHeadlineRevenueByLocDay(ctx, rows.revenue, rows.products)

  let apiMergedTotal = 0
  let inboxBasisExVat: number | null = null
  for (const r of rows.revenue) {
    apiMergedTotal += Number(r.borkTotals?.ex_vat ?? 0)
    if (r.leadSource === 'inbox') {
      const ex = Number(r.totals?.ex_vat ?? 0)
      if (ex > 0) inboxBasisExVat = (inboxBasisExVat ?? 0) + ex
    }
  }

  const laborByLocHour = await resolveLaborByLocHourForDashboard(db, ctx, rows.labor)

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
      laborCostMapFromHourly(laborByLocHour),
      headlineRevenueByLocDay,
    ),
    buildRevenueDrilldownSection(db, ctx, {
      revenue: rows.revenue,
      hourly: rows.hourly,
      products: rows.products,
      tables: rows.tables,
      workers: rows.workers,
      laborByLocHour,
      headlineRevenueByLocDay,
      categoryTotals: cat,
    }),
  ])

  const summary = buildDailyOpsSummaryDto(ctx, revMap, labMap, {
    apiBusinessDaysTotal: round2(apiMergedTotal),
    inboxBasisExVat: inboxBasisExVat != null ? round2(inboxBasisExVat) : null,
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
      ? buildTodayExtrasFromHourBundle(ctx, hourBundle, rows.revenue, rows.orderTime, laborByLocHour)
      : undefined,
  )
  revenue.drilldown = drilldown

  const labor = assembleLaborFromSnapshots(ctx, rows, revMap, labMap, revByDateLocation, {
    hoursCostByContractType,
    contractTypeByDay,
  })

  return { summary, revenue, labor }
}

export function snapshotCacheControl(ctx: DailyOpsMetricsContext): string {
  const sealedPast =
    ctx.period !== 'today' && ctx.startDate === ctx.endDate && ctx.endDate < new Date().toISOString().slice(0, 10)
  return sealedPast ? 'private, max-age=300' : 'no-store'
}
