/**
 * @registry-id: dailyOpsAssembleDashboardBundleFromPeriodCache
 * @created: 2026-08-09T17:30:00.000Z
 * @last-modified: 2026-08-09T17:30:00.000Z
 * @description: Project DailyOpsDashboardBundleDto from period-cache day nodes (GET)
 * @last-fix: [2026-08-09] Phase 7 — replace dashboard-bundle read-cache on GET
 * @adr-ref: PERIOD_CACHE_ADR L2, L3
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache · level=day
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/loadDashboardBundleForGet.ts
 * ✓ server/api/daily-ops/metrics/bundle.get.ts
 * ✓ server/api/daily-ops/metrics/venue-strip.get.ts
 * ✓ server/api/daily-ops/metrics/table-occupancy-kpis.get.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsLaborMetricsDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
  PeriodBreakdownDto,
  PeriodBreakdownRowDto,
  VenueStripCardDto,
  VenueStripLaborRowDto,
  VenueStripResponseDto,
} from '~/types/daily-ops-dashboard'
import type { DailyOpsPeriodNode } from '~/types/daily-ops-period-cache'
import type {
  DailyOpsTableOccupancyHourDto,
  DailyOpsTableOccupancyKpisDto,
  DailyOpsTableOccupancyVenueDto,
} from '~/types/daily-ops-venue-tables'
import { bucketTeamFromName } from '../dailyOpsTeamBucket'
import type { DailyOpsMetricsContext } from '../dailyOpsMetrics/context'
import { enumerateUtcDatesInclusive } from '../dailyOpsMetrics/context'
import { VAT_DISCLAIMER } from '../dailyOpsMetrics/dtoBuilders'
import { emptyDashboardBundleForCacheMiss } from '../dailyOpsSnapshot/emptyDashboardBundleForCacheMiss'
import type { DailyOpsDashboardBundleDto } from '../dailyOpsSnapshot/fetchDashboardBundle'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import { productivityPerHour } from '../venueStrip/labor'
import {
  DAILY_OPS_VENUE_TABLES_COLLECTION,
  ensureVenueTablesIndex,
  normalizeLocationId,
} from '../dailyOpsVenueTables/collection'
import { occupancyPct } from '../dailyOpsVenueTables/buildTableOccupancySummary'
import { loadPeriodDayNodesForRange } from './loadPeriodDayNodesForRange'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function emptyLaborRow (): VenueStripLaborRowDto {
  return { workers: 0, hours: 0, wages: 0, loaded: 0, laborPctOfRevenue: null }
}

function withPct (row: VenueStripLaborRowDto, revenue: number): VenueStripLaborRowDto {
  return {
    ...row,
    laborPctOfRevenue: revenue > 0 ? round2((row.loaded / revenue) * 100) : null,
  }
}

function leadSourceFromNodes (
  nodes: DailyOpsPeriodNode[],
): DailyOpsSummaryDto['summary']['revenueLeadSource'] {
  let inbox = 0
  let bork = 0
  for (const n of nodes) {
    if (n.revenue.leadSource === 'inbox_digest') inbox++
    if (n.revenue.leadSource === 'live_bork') bork++
  }
  if (inbox > 0) return 'inbox_basis_ex_vat'
  if (bork > 0) return 'bork_api_merged'
  return undefined
}

function venueNodesForStrip (nodes: DailyOpsPeriodNode[]): DailyOpsPeriodNode[] {
  const byLoc = new Map<string, DailyOpsPeriodNode[]>()
  for (const n of nodes) {
    if (n.locationId === 'all') continue
    const list = byLoc.get(n.locationId) ?? []
    list.push(n)
    byLoc.set(n.locationId, list)
  }
  return [...byLoc.entries()].flatMap(([, list]) => list)
}

function sumNodes (nodes: DailyOpsPeriodNode[]): {
  revenue: number
  revenueIncVat: number
  food: number
  beverage: number
  hours: number
  wageCost: number
  loadedCost: number
} {
  let revenue = 0
  let revenueIncVat = 0
  let food = 0
  let beverage = 0
  let hours = 0
  let wageCost = 0
  let loadedCost = 0
  for (const n of nodes) {
    revenue += n.revenue.exVat
    revenueIncVat += n.revenue.incVat
    food += n.revenue.food
    beverage += n.revenue.beverage
    hours += n.labor.hours
    wageCost += n.labor.wageCost
    loadedCost += n.labor.loadedCost
  }
  return {
    revenue: round2(revenue),
    revenueIncVat: round2(revenueIncVat),
    food: round2(food),
    beverage: round2(beverage),
    hours: round2(hours),
    wageCost: round2(wageCost),
    loadedCost: round2(loadedCost),
  }
}

function laborBucketsFromNodes (
  nodes: DailyOpsPeriodNode[],
  revenue: number,
): VenueStripCardDto['labor'] {
  const buckets = {
    all: emptyLaborRow(),
    gewerkt: emptyLaborRow(),
    keuken: emptyLaborRow(),
    bediening: emptyLaborRow(),
    other: emptyLaborRow(),
  }
  const workerIds = {
    all: new Set<string>(),
    gewerkt: new Set<string>(),
    keuken: new Set<string>(),
    bediening: new Set<string>(),
    other: new Set<string>(),
  }

  for (const n of nodes) {
    for (const w of n.staff.workers ?? []) {
      if (w.hours <= 0) continue
      const id = w.memberId || `${w.team}|${w.hours}`
      const bucket = bucketTeamFromName(w.team)
      const target =
        bucket === 'keuken'
          ? 'keuken'
          : bucket === 'bediening'
            ? 'bediening'
            : 'other'
      const row = buckets[target]
      row.hours = round2(row.hours + w.hours)
      row.wages = round2(row.wages + w.wage)
      row.loaded = round2(row.loaded + w.wage)
      workerIds[target].add(id)

      buckets.all.hours = round2(buckets.all.hours + w.hours)
      buckets.all.wages = round2(buckets.all.wages + w.wage)
      buckets.all.loaded = round2(buckets.all.loaded + w.wage)
      workerIds.all.add(id)

      if (target === 'keuken' || target === 'bediening') {
        buckets.gewerkt.hours = round2(buckets.gewerkt.hours + w.hours)
        buckets.gewerkt.wages = round2(buckets.gewerkt.wages + w.wage)
        buckets.gewerkt.loaded = round2(buckets.gewerkt.loaded + w.wage)
        workerIds.gewerkt.add(id)
      }
    }
  }

  for (const key of ['all', 'gewerkt', 'keuken', 'bediening', 'other'] as const) {
    buckets[key].workers = workerIds[key].size
    buckets[key] = withPct(buckets[key], revenue)
  }
  return buckets
}

function buildVenueStripFromNodes (
  ctx: DailyOpsMetricsContext,
  nodes: DailyOpsPeriodNode[],
): VenueStripResponseDto {
  const venues = VENUE_STRIP_LOCATIONS.map((venue) => {
    const locNodes = nodes.filter((n) => n.locationId === venue.locationId)
    const sums = sumNodes(locNodes)
    const labor = laborBucketsFromNodes(locNodes, sums.revenue)
    const foodInc =
      sums.revenue > 0 ? round2(sums.revenueIncVat * (sums.food / sums.revenue)) : 0
    const bevInc =
      sums.revenue > 0 ? round2(sums.revenueIncVat * (sums.beverage / sums.revenue)) : 0
    return {
      locationId: venue.locationId,
      locationName: locNodes[0]?.locationName ?? venue.locationName,
      revenue: {
        total: sums.revenue,
        food: sums.food,
        beverage: sums.beverage,
        totalIncVat: sums.revenueIncVat,
        foodIncVat: foodInc,
        beverageIncVat: bevInc,
      },
      labor,
      workers: [],
      active: { workers: 0, rows: [] },
      productivity: {
        totalPerHour: productivityPerHour(sums.revenue, labor.gewerkt.hours),
        keukenPerHour: productivityPerHour(sums.food, labor.keuken.hours),
        bedieningPerHour: productivityPerHour(sums.beverage, labor.bediening.hours),
      },
      contractsByTeam: { keuken: [], bediening: [], other: [] },
      coverage: {
        hasRevenue: sums.revenue > 0,
        hasLabor: labor.all.hours > 0,
        snapshotBuilt: locNodes.length > 0,
      },
    } satisfies VenueStripCardDto
  })

  return {
    range: { period: ctx.period, startDate: ctx.startDate, endDate: ctx.endDate },
    venues,
  }
}

function buildPeriodBreakdown (
  ctx: DailyOpsMetricsContext,
  nodes: DailyOpsPeriodNode[],
): PeriodBreakdownDto {
  const byDate = new Map<string, { revenue: number; laborCost: number; hours: number }>()
  for (const n of nodes) {
    if (n.locationId === 'all') continue
    const cur = byDate.get(n.periodKey) ?? { revenue: 0, laborCost: 0, hours: 0 }
    cur.revenue += n.revenue.exVat
    cur.laborCost += n.labor.loadedCost
    cur.hours += n.labor.hours
    byDate.set(n.periodKey, cur)
  }

  const singleDay = ctx.startDate === ctx.endDate
  if (singleDay) {
    const hourMap = new Map<number, { revenue: number; laborCost: number; hours: number }>()
    for (const n of nodes) {
      if (n.locationId === 'all') continue
      const dayHours = n.labor.hours
      const dayLoaded = n.labor.loadedCost
      const dayRev = n.revenue.exVat || 1
      for (const h of n.revenue.byHour ?? []) {
        const cur = hourMap.get(h.hour) ?? { revenue: 0, laborCost: 0, hours: 0 }
        cur.revenue += h.exVat
        const share = dayRev > 0 ? h.exVat / dayRev : 0
        cur.laborCost += dayLoaded * share
        cur.hours += dayHours * share
        hourMap.set(h.hour, cur)
      }
    }
    const rows: PeriodBreakdownRowDto[] = Array.from({ length: 24 }, (_, hour) => {
      const cur = hourMap.get(hour) ?? { revenue: 0, laborCost: 0, hours: 0 }
      const revenue = round2(cur.revenue)
      const laborCost = round2(cur.laborCost)
      const laborHours = round2(cur.hours)
      return {
        bucketKey: String(hour),
        bucketLabel: `${String(hour).padStart(2, '0')}:00`,
        revenue,
        laborCost,
        laborHours,
        productivity: laborHours > 0 ? round2(revenue / laborHours) : null,
        staffCount: 0,
        profit: round2(revenue - laborCost),
      }
    })
    return { granularity: 'hour', rows, byVenue: [] }
  }

  const rows: PeriodBreakdownRowDto[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cur]) => {
      const revenue = round2(cur.revenue)
      const laborCost = round2(cur.laborCost)
      const laborHours = round2(cur.hours)
      return {
        bucketKey: date,
        bucketLabel: date,
        revenue,
        laborCost,
        laborHours,
        productivity: laborHours > 0 ? round2(revenue / laborHours) : null,
        staffCount: 0,
        profit: round2(revenue - laborCost),
      }
    })
  return { granularity: 'day', rows, byVenue: [] }
}

async function loadTotalTablesByLocation (db: Db): Promise<Map<string, number>> {
  await ensureVenueTablesIndex(db)
  const rows = await db
    .collection(DAILY_OPS_VENUE_TABLES_COLLECTION)
    .aggregate<{ _id: string; n: number }>([
      { $group: { _id: '$locationId', n: { $sum: 1 } } },
    ])
    .toArray()
  const map = new Map<string, number>()
  for (const r of rows) {
    map.set(normalizeLocationId(String(r._id)), r.n)
  }
  return map
}

function buildTableOccupancyFromNodes (
  ctx: DailyOpsMetricsContext,
  nodes: DailyOpsPeriodNode[],
  totalByLoc: Map<string, number>,
): DailyOpsTableOccupancyKpisDto {
  const venues: DailyOpsTableOccupancyVenueDto[] = []
  const hourly: DailyOpsTableOccupancyHourDto[] = []
  const singleDay = ctx.startDate === ctx.endDate

  for (const venue of VENUE_STRIP_LOCATIONS) {
    if (ctx.locationId && ctx.locationId !== 'all' && ctx.locationId !== venue.locationId) {
      continue
    }
    const locNodes = nodes.filter((n) => n.locationId === venue.locationId)
    const totalTables = totalByLoc.get(normalizeLocationId(venue.locationId)) ?? 0
    const dailyActive: number[] = []
    for (const n of locNodes) {
      const active = new Set((n.revenue.byTable ?? []).map((t) => t.tableNum)).size
      dailyActive.push(active)
      if (singleDay) {
        for (const h of n.revenue.tablesByHour ?? []) {
          hourly.push({
            calendarHour: h.hour,
            locationId: venue.locationId,
            locationName: venue.locationName,
            activeTables: h.activeTables,
            totalTables,
            occupancyPct: occupancyPct(h.activeTables, totalTables),
          })
        }
      }
    }
    const activeTables =
      dailyActive.length === 0
        ? 0
        : round2(dailyActive.reduce((s, n) => s + n, 0) / dailyActive.length)
    venues.push({
      locationId: venue.locationId,
      locationName: venue.locationName,
      activeTables,
      totalTables,
      occupancyPct: occupancyPct(activeTables, totalTables),
    })
  }

  const activeTables = round2(venues.reduce((s, v) => s + v.activeTables, 0))
  const totalTables = venues.reduce((s, v) => s + v.totalTables, 0)
  return {
    range: { period: ctx.period, startDate: ctx.startDate, endDate: ctx.endDate },
    activeTables,
    totalTables,
    occupancyPct: occupancyPct(activeTables, totalTables),
    venues,
    aggregation: singleDay ? 'day' : 'avg_daily',
    hourly: singleDay && hourly.length > 0 ? hourly : undefined,
  }
}

function buildSummary (
  ctx: DailyOpsMetricsContext,
  nodes: DailyOpsPeriodNode[],
  expectedDays: number,
): DailyOpsSummaryDto {
  const scoped =
    ctx.locationId && ctx.locationId !== 'all'
      ? nodes.filter((n) => n.locationId === ctx.locationId)
      : nodes.filter((n) => n.locationId === 'all').length > 0
        ? nodes.filter((n) => n.locationId === 'all')
        : nodes.filter((n) => n.locationId !== 'all')

  const sums = sumNodes(scoped.length ? scoped : nodes)
  const profit = round2(sums.revenue - sums.loadedCost - scoped.reduce((s, n) => s + n.cogs.amount, 0))
  const foundDates = new Set(scoped.map((n) => n.periodKey))
  const expected = enumerateUtcDatesInclusive(ctx.startDate, ctx.endDate)
  const missingDates = expected.filter((d) => !foundDates.has(d))

  return {
    range: { period: ctx.period, startDate: ctx.startDate, endDate: ctx.endDate },
    snapshotCoverage: {
      daysExpected: expectedDays,
      daysFound: foundDates.size,
      missingDates,
    },
    summary: {
      totalRevenue: sums.revenue,
      totalLaborCost: sums.loadedCost,
      totalLaborHours: sums.hours,
      profit,
      profitMarginPct: sums.revenue > 0 ? round2((profit / sums.revenue) * 100) : 0,
      revenuePerLaborHour: sums.hours > 0 ? round2(sums.revenue / sums.hours) : null,
      laborCostPctOfRevenue:
        sums.revenue > 0 ? round2((sums.loadedCost / sums.revenue) * 100) : null,
      revenueLeadSource: leadSourceFromNodes(scoped),
      revenueSources: {
        apiBusinessDaysTotal: sums.revenue,
        inboxBasisExVat:
          leadSourceFromNodes(scoped) === 'inbox_basis_ex_vat' ? sums.revenue : null,
      },
    },
    vatDisclaimer: VAT_DISCLAIMER,
  }
}

function buildRevenueBreakdown (
  ctx: DailyOpsMetricsContext,
  nodes: DailyOpsPeriodNode[],
): DailyOpsRevenueBreakdownDto {
  const scoped =
    ctx.locationId && ctx.locationId !== 'all'
      ? nodes.filter((n) => n.locationId === ctx.locationId)
      : nodes.filter((n) => n.locationId !== 'all')

  const catMap = new Map<string, number>()
  for (const n of scoped) {
    for (const c of n.revenue.byCategory ?? []) {
      catMap.set(c.name, round2((catMap.get(c.name) ?? 0) + c.exVat))
    }
  }
  const revenueByCategory = [...catMap.entries()]
    .map(([label, amount]) => ({ key: label, label, amount }))
    .sort((a, b) => b.amount - a.amount)

  const hourTotals = new Map<number, number>()
  for (const n of scoped) {
    for (const h of n.revenue.byHour ?? []) {
      hourTotals.set(h.hour, round2((hourTotals.get(h.hour) ?? 0) + h.exVat))
    }
  }
  let bestHour = 0
  let bestRev = 0
  for (const [hour, rev] of hourTotals) {
    if (rev > bestRev) {
      bestRev = rev
      bestHour = hour
    }
  }

  return {
    range: { period: ctx.period, startDate: ctx.startDate, endDate: ctx.endDate },
    revenueByCategory,
    revenueByTimePeriod: [],
    mostProfitableHour: {
      hourLabel: `${String(bestHour).padStart(2, '0')}:00`,
      date: ctx.endDate,
      hour: bestHour,
      revenue: bestRev,
      laborCost: 0,
      cogsCost: 0,
      fixedCost: 0,
      profit: bestRev,
      estimatesNote: 'Period-cache projection (Phase 7)',
    },
    profitByInterval: {
      estimatesNote: 'Period-cache projection (Phase 7)',
      dates: [],
      cells: [],
    },
  }
}

function buildLaborMetrics (
  ctx: DailyOpsMetricsContext,
  nodes: DailyOpsPeriodNode[],
): DailyOpsLaborMetricsDto {
  const scoped =
    ctx.locationId && ctx.locationId !== 'all'
      ? nodes.filter((n) => n.locationId === ctx.locationId)
      : nodes.filter((n) => n.locationId !== 'all')

  const teamMap = new Map<
    string,
    { locationId: string; locationName: string; teamName: string; hours: number; cost: number; workers: Set<string> }
  >()
  const dailyMap = new Map<string, { revenue: number; laborCost: number; hours: number; workers: Set<string> }>()
  const revByLocDay: DailyOpsLaborMetricsDto['revenueByLocationDay'] = []
  const locLaborPct: DailyOpsLaborMetricsDto['locationLaborPctByDay'] = []

  for (const n of scoped) {
    revByLocDay.push({
      date: n.periodKey,
      locationId: n.locationId,
      revenue: round2(n.revenue.exVat),
    })
    locLaborPct.push({
      date: n.periodKey,
      locationId: n.locationId,
      laborCostPctOfRevenue:
        n.revenue.exVat > 0
          ? round2((n.labor.loadedCost / n.revenue.exVat) * 100)
          : null,
    })

    const day = dailyMap.get(n.periodKey) ?? {
      revenue: 0,
      laborCost: 0,
      hours: 0,
      workers: new Set<string>(),
    }
    day.revenue += n.revenue.exVat
    day.laborCost += n.labor.loadedCost
    day.hours += n.labor.hours
    for (const w of n.staff.workers ?? []) {
      if (w.memberId) day.workers.add(w.memberId)
      const key = `${n.locationId}|${w.team}`
      const cur = teamMap.get(key) ?? {
        locationId: n.locationId,
        locationName: n.locationName,
        teamName: w.team || 'Other',
        hours: 0,
        cost: 0,
        workers: new Set<string>(),
      }
      cur.hours += w.hours
      cur.cost += w.wage
      if (w.memberId) cur.workers.add(w.memberId)
      teamMap.set(key, cur)
    }
    dailyMap.set(n.periodKey, day)
  }

  const sums = sumNodes(scoped)
  return {
    range: { period: ctx.period, startDate: ctx.startDate, endDate: ctx.endDate },
    inventory: {
      hasBorkCronData: sums.revenue > 0,
      hasBorkHourData: scoped.some((n) => (n.revenue.byHour ?? []).length > 0),
      hasEitjeAggData: sums.hours > 0,
      notes: [],
    },
    workersByTeamLocation: [...teamMap.values()].map((t) => ({
      locationId: t.locationId,
      locationName: t.locationName,
      teamId: t.teamName,
      teamName: t.teamName,
      workerCount: t.workers.size,
      totalHours: round2(t.hours),
      totalCost: round2(t.cost),
    })),
    workersByTeamLocationByDay: [],
    locationLaborPctByDay: locLaborPct,
    revenueByLocationDay: revByLocDay,
    hoursCostByContractType: [],
    contractTypeByDay: [],
    daily: [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        revenue: round2(d.revenue),
        laborCost: round2(d.laborCost),
        hours: round2(d.hours),
        distinctWorkerCount: d.workers.size,
        laborCostPctOfRevenue:
          d.revenue > 0 ? round2((d.laborCost / d.revenue) * 100) : null,
        revenuePerLaborHour: d.hours > 0 ? round2(d.revenue / d.hours) : null,
      })),
    periodRollup: {
      revenue: sums.revenue,
      laborCost: sums.loadedCost,
      hours: sums.hours,
      laborCostPctOfRevenue:
        sums.revenue > 0 ? round2((sums.loadedCost / sums.revenue) * 100) : null,
      revenuePerLaborHour: sums.hours > 0 ? round2(sums.revenue / sums.hours) : null,
    },
    productivityByLocationDay: [],
  }
}

/** Project dashboard bundle from period-cache day nodes. Miss → empty + dataGap shape. */
export async function assembleDashboardBundleFromPeriodCache (
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsDashboardBundleDto> {
  const locationId = ctx.locationId ?? 'all'
  const loadLoc = locationId === 'all' ? 'all' : locationId

  let nodes = await loadPeriodDayNodesForRange(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: loadLoc,
  })

  // For strip + multi-venue labor, also load per-venue days when querying "all".
  if (loadLoc === 'all') {
    const venueLists = await Promise.all(
      VENUE_STRIP_LOCATIONS.map((v) =>
        loadPeriodDayNodesForRange(db, {
          startDate: ctx.startDate,
          endDate: ctx.endDate,
          locationId: v.locationId,
        }),
      ),
    )
    const byKey = new Map<string, DailyOpsPeriodNode>()
    for (const n of nodes) byKey.set(`${n.locationId}|${n.periodKey}`, n)
    for (const list of venueLists) {
      for (const n of list) byKey.set(`${n.locationId}|${n.periodKey}`, n)
    }
    nodes = [...byKey.values()]
  }

  if (nodes.length === 0) {
    return emptyDashboardBundleForCacheMiss(ctx)
  }

  const expectedDays = enumerateUtcDatesInclusive(ctx.startDate, ctx.endDate).length
  const stripNodes = venueNodesForStrip(nodes)
  const totalByLoc = await loadTotalTablesByLocation(db)

  return {
    summary: buildSummary(ctx, nodes, expectedDays),
    revenue: buildRevenueBreakdown(ctx, nodes),
    labor: buildLaborMetrics(ctx, nodes),
    venueStrip: buildVenueStripFromNodes(ctx, stripNodes.length ? stripNodes : nodes),
    periodBreakdown: buildPeriodBreakdown(ctx, stripNodes.length ? stripNodes : nodes),
    tableOccupancy: buildTableOccupancyFromNodes(
      ctx,
      stripNodes.length ? stripNodes : nodes,
      totalByLoc,
    ),
  }
}
