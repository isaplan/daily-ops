/**
 * @registry-id: dailyOpsAssembleDashboardBundleFromPeriodCache
 * @created: 2026-08-09T17:30:00.000Z
 * @last-modified: 2026-08-20T11:50:00.000Z
 * @description: Project DailyOpsDashboardBundleDto from period-cache day nodes (GET)
 * @last-fix: [2026-08-20] Fill periodBreakdown staffCount/staffByTeam + labor byTeamDay
 *   Prior: [2026-08-16] Fill periodBreakdown.byVenue (Locations graph was empty)
 * @adr-ref: PERIOD_CACHE_ADR L2, L3, ADR-004, ADR-013, ADR-014, ADR-022
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
  DailyOpsProfitByIntervalDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
  PeriodBreakdownDto,
  PeriodBreakdownRowDto,
  PeriodBreakdownStaffByTeamDto,
  VenueStripCardDto,
  VenueStripLaborRowDto,
  VenueStripResponseDto,
} from '~/types/daily-ops-dashboard'
import type { DailyOpsPeriodNode } from '~/types/daily-ops-period-cache'
import type {
  DailyOpsOccupancySeriesPoint,
  DailyOpsTableOccupancyDayDto,
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
import { buildProfitByIntervalFromSnapshotHourly } from '../dailyOpsSnapshot/buildProfitByIntervalFromSnapshot'
import { snapshotLocDayKey } from '../dailyOpsSnapshot/dashboardBundle/shared'
import { hourLabel } from '../dailyOpsSnapshot/drilldown/drilldownShared'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import { productivityPerHour } from '../venueStrip/labor'
import {
  DAILY_OPS_VENUE_TABLES_COLLECTION,
  ensureVenueTablesIndex,
  normalizeLocationId,
} from '../dailyOpsVenueTables/collection'
import { occupancyPct } from '../dailyOpsVenueTables/buildTableOccupancySummary'
import {
  buildOccupancySeriesByGrain,
  combineDailyOccupancyPoints,
} from '../dailyOpsVenueTables/buildOccupancySeries'
import { alignProfitByIntervalToSealedFinance } from './alignProfitByIntervalToSealedFinance'
import { loadPeriodDayNodesForRange } from './loadPeriodDayNodesForRange'
import { resolvePeriodRange, sumResolvedNodes } from './resolvePeriodRange'

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

function emptyStaffByTeam (): PeriodBreakdownStaffByTeamDto {
  return { keuken: 0, bediening: 0 }
}

function staffCountFromTeam (team: PeriodBreakdownStaffByTeamDto): number {
  return team.keuken + team.bediening
}

/** Keuken + Bediening headcount from sealed day node workers (excludes ziek/verlof). */
function staffByTeamFromNode (node: DailyOpsPeriodNode): PeriodBreakdownStaffByTeamDto {
  const out = emptyStaffByTeam()
  const seen = { keuken: new Set<string>(), bediening: new Set<string>() }
  for (const w of node.staff.workers ?? []) {
    if (w.sick || w.leave || !(w.hours > 0)) continue
    const bucket = bucketTeamFromName(w.team)
    if (bucket !== 'keuken' && bucket !== 'bediening') continue
    const id = w.memberId || `${w.team}|${w.hours}`
    if (seen[bucket].has(id)) continue
    seen[bucket].add(id)
    out[bucket] += 1
  }
  return out
}

function finalizeBreakdownRow (
  bucketKey: string,
  bucketLabel: string,
  cur: { revenue: number; laborCost: number; hours: number },
  staffByTeam: PeriodBreakdownStaffByTeamDto = emptyStaffByTeam(),
): PeriodBreakdownRowDto {
  const revenue = round2(cur.revenue)
  const laborCost = round2(cur.laborCost)
  const laborHours = round2(cur.hours)
  const staffCount = staffCountFromTeam(staffByTeam)
  return {
    bucketKey,
    bucketLabel,
    revenue,
    laborCost,
    laborHours,
    productivity: laborHours > 0 ? round2(revenue / laborHours) : null,
    staffByTeam,
    staffCount,
    profit: round2(revenue - laborCost),
  }
}

/**
 * Allocate day keuken/bediening headcount across hours by labor-hour share
 * (sealed period-cache has no hourly staff; live Today uses shift overlap).
 */
function allocateStaffByHourShare (
  dayStaff: PeriodBreakdownStaffByTeamDto,
  hourHours: number,
  dayHours: number,
): PeriodBreakdownStaffByTeamDto {
  if (!(dayHours > 0) || !(hourHours > 0)) return emptyStaffByTeam()
  const share = hourHours / dayHours
  return {
    keuken: Math.round(dayStaff.keuken * share),
    bediening: Math.round(dayStaff.bediening * share),
  }
}

function buildPeriodBreakdown (
  ctx: DailyOpsMetricsContext,
  nodes: DailyOpsPeriodNode[],
): PeriodBreakdownDto {
  const venueNodes = nodes.filter((n) => n.locationId !== 'all')
  const singleDay = ctx.startDate === ctx.endDate

  if (singleDay) {
    const hourMap = new Map<number, { revenue: number; laborCost: number; hours: number }>()
    const byVenueHour = new Map<string, Map<number, { revenue: number; laborCost: number; hours: number }>>()
    const dayStaffByVenue = new Map<string, PeriodBreakdownStaffByTeamDto>()
    const dayHoursByVenue = new Map<string, number>()

    for (const venue of VENUE_STRIP_LOCATIONS) {
      byVenueHour.set(venue.locationId, new Map())
      dayStaffByVenue.set(venue.locationId, emptyStaffByTeam())
      dayHoursByVenue.set(venue.locationId, 0)
    }

    for (const n of venueNodes) {
      const dayHours = n.labor.hours
      const dayLoaded = n.labor.loadedCost
      const dayRev = n.revenue.exVat || 1
      const locMap = byVenueHour.get(n.locationId) ?? new Map()
      byVenueHour.set(n.locationId, locMap)
      dayStaffByVenue.set(n.locationId, staffByTeamFromNode(n))
      dayHoursByVenue.set(n.locationId, dayHours)

      for (const h of n.revenue.byHour ?? []) {
        const share = dayRev > 0 ? h.exVat / dayRev : 0
        const laborCost = dayLoaded * share
        const hours = dayHours * share

        const allCur = hourMap.get(h.hour) ?? { revenue: 0, laborCost: 0, hours: 0 }
        allCur.revenue += h.exVat
        allCur.laborCost += laborCost
        allCur.hours += hours
        hourMap.set(h.hour, allCur)

        const locCur = locMap.get(h.hour) ?? { revenue: 0, laborCost: 0, hours: 0 }
        locCur.revenue += h.exVat
        locCur.laborCost += laborCost
        locCur.hours += hours
        locMap.set(h.hour, locCur)
      }
    }

    const orgDayStaff = emptyStaffByTeam()
    let orgDayHours = 0
    for (const venue of VENUE_STRIP_LOCATIONS) {
      const s = dayStaffByVenue.get(venue.locationId) ?? emptyStaffByTeam()
      orgDayStaff.keuken += s.keuken
      orgDayStaff.bediening += s.bediening
      orgDayHours += dayHoursByVenue.get(venue.locationId) ?? 0
    }

    const rows: PeriodBreakdownRowDto[] = Array.from({ length: 24 }, (_, hour) => {
      const cur = hourMap.get(hour) ?? { revenue: 0, laborCost: 0, hours: 0 }
      return finalizeBreakdownRow(
        String(hour),
        `${String(hour).padStart(2, '0')}:00`,
        cur,
        allocateStaffByHourShare(orgDayStaff, cur.hours, orgDayHours),
      )
    })

    const byVenue = VENUE_STRIP_LOCATIONS.map((venue) => {
      const locMap = byVenueHour.get(venue.locationId) ?? new Map()
      const dayStaff = dayStaffByVenue.get(venue.locationId) ?? emptyStaffByTeam()
      const dayHours = dayHoursByVenue.get(venue.locationId) ?? 0
      return {
        locationId: venue.locationId,
        locationName: venue.locationName,
        rows: Array.from({ length: 24 }, (_, hour) => {
          const cur = locMap.get(hour) ?? { revenue: 0, laborCost: 0, hours: 0 }
          return finalizeBreakdownRow(
            String(hour),
            `${String(hour).padStart(2, '0')}:00`,
            cur,
            allocateStaffByHourShare(dayStaff, cur.hours, dayHours),
          )
        }),
      }
    })

    return { granularity: 'hour', rows, byVenue }
  }

  type Acc = { revenue: number; laborCost: number; hours: number; staff: PeriodBreakdownStaffByTeamDto }
  const byDate = new Map<string, Acc>()
  const byVenueDate = new Map<string, Map<string, Acc>>()
  for (const venue of VENUE_STRIP_LOCATIONS) {
    byVenueDate.set(venue.locationId, new Map())
  }

  for (const n of venueNodes) {
    const staff = staffByTeamFromNode(n)
    const cur = byDate.get(n.periodKey) ?? {
      revenue: 0,
      laborCost: 0,
      hours: 0,
      staff: emptyStaffByTeam(),
    }
    cur.revenue += n.revenue.exVat
    cur.laborCost += n.labor.loadedCost
    cur.hours += n.labor.hours
    cur.staff.keuken += staff.keuken
    cur.staff.bediening += staff.bediening
    byDate.set(n.periodKey, cur)

    const locMap = byVenueDate.get(n.locationId) ?? new Map()
    byVenueDate.set(n.locationId, locMap)
    const locCur = locMap.get(n.periodKey) ?? {
      revenue: 0,
      laborCost: 0,
      hours: 0,
      staff: emptyStaffByTeam(),
    }
    locCur.revenue += n.revenue.exVat
    locCur.laborCost += n.labor.loadedCost
    locCur.hours += n.labor.hours
    locCur.staff = staff
    locMap.set(n.periodKey, locCur)
  }

  const dates = [...byDate.keys()].sort((a, b) => a.localeCompare(b))
  const rows: PeriodBreakdownRowDto[] = dates.map((date) => {
    const cur = byDate.get(date)!
    return finalizeBreakdownRow(date, date, cur, cur.staff)
  })

  const byVenue = VENUE_STRIP_LOCATIONS.map((venue) => {
    const locMap = byVenueDate.get(venue.locationId) ?? new Map()
    const venueDates = dates.length > 0 ? dates : [...locMap.keys()].sort((a, b) => a.localeCompare(b))
    return {
      locationId: venue.locationId,
      locationName: venue.locationName,
      rows: venueDates.map((date) => {
        const cur = locMap.get(date) ?? {
          revenue: 0,
          laborCost: 0,
          hours: 0,
          staff: emptyStaffByTeam(),
        }
        return finalizeBreakdownRow(date, date, cur, cur.staff)
      }),
    }
  })

  return { granularity: 'day', rows, byVenue }
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

function buildOrgHourSeries (
  hourly: DailyOpsTableOccupancyHourDto[],
): DailyOpsOccupancySeriesPoint[] {
  const byHour = new Map<number, { active: number; total: number }>()
  for (const row of hourly) {
    const cur = byHour.get(row.calendarHour) ?? { active: 0, total: 0 }
    cur.active += row.activeTables
    cur.total += row.totalTables
    byHour.set(row.calendarHour, cur)
  }
  return Array.from({ length: 24 }, (_, calendarHour) => {
    const cur = byHour.get(calendarHour) ?? { active: 0, total: 0 }
    return {
      key: String(calendarHour),
      label: hourLabel(calendarHour),
      activeTables: cur.active,
      totalTables: cur.total,
      occupancyPct: occupancyPct(cur.active, cur.total),
    }
  })
}

function withOccupancySeries (
  dto: DailyOpsTableOccupancyKpisDto,
  hourly?: DailyOpsTableOccupancyHourDto[],
): DailyOpsTableOccupancyKpisDto {
  const dayPoints = dto.daily?.length
    ? combineDailyOccupancyPoints(dto.daily)
    : [{
        key: dto.range.startDate,
        label: dto.range.startDate,
        activeTables: dto.activeTables,
        totalTables: dto.totalTables,
        occupancyPct: dto.occupancyPct,
      }]
  const series = buildOccupancySeriesByGrain(dayPoints)
  if (hourly?.length) {
    series.hour = buildOrgHourSeries(hourly)
  }
  return {
    ...dto,
    ...(hourly?.length ? { hourly } : {}),
    series,
  }
}

function buildTableOccupancyFromNodes (
  ctx: DailyOpsMetricsContext,
  nodes: DailyOpsPeriodNode[],
  totalByLoc: Map<string, number>,
): DailyOpsTableOccupancyKpisDto {
  const venues: DailyOpsTableOccupancyVenueDto[] = []
  const hourly: DailyOpsTableOccupancyHourDto[] = []
  const daily: DailyOpsTableOccupancyDayDto[] = []
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
      daily.push({
        date: n.periodKey,
        locationId: venue.locationId,
        locationName: venue.locationName,
        activeTables: active,
        totalTables,
        occupancyPct: occupancyPct(active, totalTables),
      })
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
  const hourlyOut = singleDay && hourly.length > 0 ? hourly : undefined
  return withOccupancySeries(
    {
      range: { period: ctx.period, startDate: ctx.startDate, endDate: ctx.endDate },
      activeTables,
      totalTables,
      occupancyPct: occupancyPct(activeTables, totalTables),
      venues,
      aggregation: singleDay ? 'day' : 'avg_daily',
      daily: daily.length > 0 ? daily : undefined,
    },
    hourlyOut,
  )
}

async function buildSummary (
  db: Db,
  ctx: DailyOpsMetricsContext,
  nodes: DailyOpsPeriodNode[],
  expectedDays: number,
): Promise<DailyOpsSummaryDto> {
  const scoped =
    ctx.locationId && ctx.locationId !== 'all'
      ? nodes.filter((n) => n.locationId === ctx.locationId)
      : nodes.filter((n) => n.locationId === 'all').length > 0
        ? nodes.filter((n) => n.locationId === 'all')
        : nodes.filter((n) => n.locationId !== 'all')

  const sums = sumNodes(scoped.length ? scoped : nodes)
  const coverLoc =
    ctx.locationId && ctx.locationId !== 'all' ? ctx.locationId : 'all'
  const cover = await resolvePeriodRange(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId: coverLoc,
  })
  // ADR-022: greedy month/week/day cover — sealed months use Finance result via ratios.netProfit
  const profit = sumResolvedNodes(cover.nodes).netProfit
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

/** Map sealed day nodes → same profit-by-interval builder as snapshot GET (no live Bork). */
async function buildProfitByIntervalFromNodes (
  ctx: DailyOpsMetricsContext,
  nodes: DailyOpsPeriodNode[],
): Promise<DailyOpsProfitByIntervalDto> {
  const scoped =
    ctx.locationId && ctx.locationId !== 'all'
      ? nodes.filter((n) => n.locationId === ctx.locationId)
      : nodes.filter((n) => n.locationId !== 'all')

  const hourRows: { _id: { d: string; h: number; loc?: string }; revenue: number }[] = []
  const laborByLocDay = new Map<string, { laborCost: number; hours: number; distinctWorkerCount: number }>()
  const headlineRevenueByLocDay = new Map<string, number>()
  let food = 0
  let drinks = 0

  for (const n of scoped) {
    const key = snapshotLocDayKey(n.periodKey, n.locationId)
    headlineRevenueByLocDay.set(key, round2((headlineRevenueByLocDay.get(key) ?? 0) + n.revenue.exVat))
    const laborCur = laborByLocDay.get(key) ?? { laborCost: 0, hours: 0, distinctWorkerCount: 0 }
    laborCur.laborCost += n.labor.loadedCost
    laborCur.hours += n.labor.hours
    laborCur.distinctWorkerCount += n.labor.staffCount
    laborByLocDay.set(key, laborCur)
    food += n.revenue.food
    drinks += n.revenue.beverage
    for (const h of n.revenue.byHour ?? []) {
      hourRows.push({
        _id: { d: n.periodKey, h: h.hour, loc: n.locationId },
        revenue: h.exVat,
      })
    }
  }

  return buildProfitByIntervalFromSnapshotHourly(
    ctx,
    hourRows,
    { food, drinks },
    laborByLocDay,
    headlineRevenueByLocDay,
    undefined,
    new Map(),
  )
}

async function buildRevenueBreakdown (
  db: Db,
  ctx: DailyOpsMetricsContext,
  nodes: DailyOpsPeriodNode[],
): Promise<DailyOpsRevenueBreakdownDto> {
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

  const profitByIntervalRaw = await buildProfitByIntervalFromNodes(ctx, nodes)
  const profitByInterval = await alignProfitByIntervalToSealedFinance(db, profitByIntervalRaw, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
  })

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
      estimatesNote: 'Period-cache projection',
    },
    profitByInterval,
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
  const teamDayMap = new Map<
    string,
    { date: string; locationId: string; locationName: string; teamName: string; hours: number; cost: number; workers: Set<string> }
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
      const teamName = w.team || 'Other'
      const key = `${n.locationId}|${teamName}`
      const cur = teamMap.get(key) ?? {
        locationId: n.locationId,
        locationName: n.locationName,
        teamName,
        hours: 0,
        cost: 0,
        workers: new Set<string>(),
      }
      cur.hours += w.hours
      cur.cost += w.wage
      if (w.memberId) cur.workers.add(w.memberId)
      teamMap.set(key, cur)

      const dayKey = `${n.periodKey}|${n.locationId}|${teamName}`
      const dayCur = teamDayMap.get(dayKey) ?? {
        date: n.periodKey,
        locationId: n.locationId,
        locationName: n.locationName,
        teamName,
        hours: 0,
        cost: 0,
        workers: new Set<string>(),
      }
      dayCur.hours += w.hours
      dayCur.cost += w.wage
      if (w.memberId) dayCur.workers.add(w.memberId)
      teamDayMap.set(dayKey, dayCur)
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
    workersByTeamLocationByDay: [...teamDayMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date) || a.locationId.localeCompare(b.locationId))
      .map((t) => ({
        date: t.date,
        locationId: t.locationId,
        locationName: t.locationName,
        teamId: t.teamName,
        teamName: t.teamName,
        workerCount: t.workers.size,
        totalHours: round2(t.hours),
        totalCost: round2(t.cost),
        laborCostPctOfRevenue: null,
      })),
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

function emptyVenueStrip (ctx: DailyOpsMetricsContext): VenueStripResponseDto {
  return {
    range: {
      period: ctx.period as VenueStripResponseDto['range']['period'],
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    venues: VENUE_STRIP_LOCATIONS.map((v) => ({
      locationId: v.locationId,
      locationName: v.locationName,
      revenue: {
        total: 0,
        food: 0,
        beverage: 0,
        totalIncVat: 0,
        foodIncVat: 0,
        beverageIncVat: 0,
      },
      labor: {
        all: emptyLaborRow(),
        gewerkt: emptyLaborRow(),
        keuken: emptyLaborRow(),
        bediening: emptyLaborRow(),
        other: emptyLaborRow(),
      },
      workers: [],
      active: { workers: 0, rows: [] },
      productivity: { totalPerHour: null, keukenPerHour: null, bedieningPerHour: null },
      contractsByTeam: { keuken: [], bediening: [], other: [] },
      coverage: { hasRevenue: false, hasLabor: false, snapshotBuilt: false },
    })),
  }
}

export function periodCacheVersionFromNodes (nodes: DailyOpsPeriodNode[]): string | null {
  let latest = 0
  for (const n of nodes) {
    const t = Date.parse(n.provenance?.lastBuiltAt ?? '')
    if (Number.isFinite(t) && t > latest) latest = t
  }
  return latest > 0 ? new Date(latest).toISOString() : null
}

async function loadVenueDayNodesForStrip (
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsPeriodNode[]> {
  const venueLists = await Promise.all(
    VENUE_STRIP_LOCATIONS.map((v) =>
      loadPeriodDayNodesForRange(db, {
        startDate: ctx.startDate,
        endDate: ctx.endDate,
        locationId: v.locationId,
      }),
    ),
  )
  return venueLists.flat()
}

/**
 * Sealed venue-strip only — no summary/revenue/labor/occupancy assemble.
 * Used by GET /venue-strip so bundle can load once separately.
 */
export async function assembleVenueStripFromPeriodCache (
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<VenueStripResponseDto & { cacheVersion: string | null }> {
  const nodes = await loadVenueDayNodesForStrip(db, ctx)
  if (nodes.length === 0) {
    return { ...emptyVenueStrip(ctx), cacheVersion: null }
  }
  const strip = buildVenueStripFromNodes(ctx, nodes)
  return { ...strip, cacheVersion: periodCacheVersionFromNodes(nodes) }
}

/** Project dashboard bundle from period-cache day nodes. Miss → empty + dataGap shape. */
export async function assembleDashboardBundleFromPeriodCache (
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsDashboardBundleDto & { cacheVersion: string | null }> {
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
    return { ...emptyDashboardBundleForCacheMiss(ctx), cacheVersion: null }
  }

  const expectedDays = enumerateUtcDatesInclusive(ctx.startDate, ctx.endDate).length
  const stripNodes = venueNodesForStrip(nodes)
  const totalByLoc = await loadTotalTablesByLocation(db)

  const occNodes = stripNodes.length ? stripNodes : nodes
  return {
    summary: await buildSummary(db, ctx, nodes, expectedDays),
    revenue: await buildRevenueBreakdown(db, ctx, nodes),
    labor: buildLaborMetrics(ctx, nodes),
    venueStrip: buildVenueStripFromNodes(ctx, occNodes),
    periodBreakdown: buildPeriodBreakdown(ctx, occNodes),
    tableOccupancy: buildTableOccupancyFromNodes(ctx, occNodes, totalByLoc),
    cacheVersion: periodCacheVersionFromNodes(nodes),
  }
}
