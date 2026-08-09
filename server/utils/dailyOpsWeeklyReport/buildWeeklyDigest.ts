/**
 * @registry-id: dailyOpsWeeklyReportBuildDigest
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-08-09T00:35:00.000Z
 * @description: Aggregate 7 daily snapshots into weekly-digest payload (ADR-013)
 * @last-fix: [2026-08-09] schemaVersion 12 — period-cache food/bev; write-path only (no GET build)
 *   Prior: [2026-07-20] tableOccupancy + rolling12 occupancy comparisons
 * @adr-ref: ADR-004, ADR-013, PERIOD_CACHE_ADR L2, L3
 * @data-source: snapshot-write-only
 * @write-cache-json: daily_ops_read_cache · profile=weekly-digest · level=weekly
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/aggregateWeeklyReadCache.ts
 * ✓ server/api/daily-ops/analytics/weekly-digest.get.ts
 */

import type { Db } from 'mongodb'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import type {
  DailyOpsSnapshotLaborSection,
  DailyOpsSnapshotMaster,
  DailyOpsSnapshotRevenueProductsSection,
  DailyOpsSnapshotRevenueSection,
  DailyOpsSnapshotRevenueTablesSection,
  DailyOpsSnapshotRevenueWorkersSection,
} from '~/types/daily-ops-snapshot'
import type {
  WeeklyCategoryMargin,
  WeeklyCompareTrend,
  WeeklyDayBreakdown,
  WeeklyDigestDto,
  WeeklyHourlyLossCell,
  WeeklyProductRow,
  WeeklySpaceMargin,
  WeeklyStaffRanking,
  WeeklyTargetsDto,
  WeeklyTeamBreakdown,
  WeeklyUpsellMetric,
} from '~/types/daily-ops-weekly-report'
import { DEFAULT_PNL_ASSUMPTIONS } from '~/utils/dailyOpsPnlAssumptionsDefaults'
import { sumFoodBeverageForRange } from '../dailyOpsPeriodCache/foodBeverageFromPeriodCache'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import {
  headlineExVatFromSnapshotSection,
  headlineIncVatFromSnapshotSection,
} from '../dailyOpsSnapshot/snapshotHeadlineRevenue'
import {
  enumerateDaysInclusive,
  previousWeekRange,
  rollingWeekRanges,
  type WeeklyRange,
} from './weekRange'
import {
  hourLabelForBusinessHour,
  laborStatus,
  marginStatus,
  pctDelta,
  pnlStatus,
  roundWeekly2,
  weekdayLabel,
} from './weeklyStatus'
import { findReadCachePayload } from '../dailyOpsReadCache/readCacheStore'
import { WEEKLY_DIGEST_PROFILE } from '~/types/daily-ops-weekly-report'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { buildWeeklyAttendance } from './buildWeeklyAttendance'
import { buildWeeklyOpeningClosing } from './buildWeeklyOpeningClosing'
import { buildWeeklyStaffPlusmin } from './buildWeeklyStaffPlusmin'
import { buildWeeklyTableOccupancy } from './buildWeeklyTableOccupancy'
import { occupancyPctByRangeKeys } from '../dailyOpsVenueTables/occupancyPctByRangeKeys'

const UPSell_PATTERNS: Record<WeeklyUpsellMetric['key'], RegExp> = {
  water: /water|spa\b|spa\s*rood|spa\s*blauw/i,
  beer: /beer|bier|birra|pils|heineken|amstel|jupiler|moretti/i,
  lemonade: /limonade|lemonade|citroen/i,
}

type SnapshotBundle = {
  masters: DailyOpsSnapshotMaster[]
  revenue: DailyOpsSnapshotRevenueSection[]
  labor: DailyOpsSnapshotLaborSection[]
  products: DailyOpsSnapshotRevenueProductsSection[]
  tables: DailyOpsSnapshotRevenueTablesSection[]
  workers: DailyOpsSnapshotRevenueWorkersSection[]
}

function locationFilter(locationId: string | undefined): Record<string, unknown> {
  if (!locationId || locationId === 'all') return {}
  return { locationId }
}

function locationNameFor(id: string): string {
  if (id === 'all') return 'All locations'
  const hit = VENUE_STRIP_LOCATIONS.find((v) => v.locationId === id)
  return hit?.locationName ?? id
}

async function fetchSnapshotBundle(
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<SnapshotBundle> {
  const dateFilter = { $gte: startDate, $lte: endDate }
  const loc = locationFilter(locationId)
  const base = { businessDate: dateFilter, ...loc }

  const [masters, revenue, labor, products, tables, workers] = await Promise.all([
    db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.master).find(base).toArray(),
    db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection).find(base).toArray(),
    db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection).find(base).toArray(),
    db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection).find(base).toArray(),
    db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueTablesSection).find(base).toArray(),
    db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueWorkersSection).find(base).toArray(),
  ])

  return {
    masters: masters as DailyOpsSnapshotMaster[],
    revenue: revenue as DailyOpsSnapshotRevenueSection[],
    labor: labor as DailyOpsSnapshotLaborSection[],
    products: products as DailyOpsSnapshotRevenueProductsSection[],
    tables: tables as DailyOpsSnapshotRevenueTablesSection[],
    workers: workers as DailyOpsSnapshotRevenueWorkersSection[],
  }
}

function sumRevenueDocs(docs: DailyOpsSnapshotRevenueSection[]) {
  let revenue = 0
  let revenueIncVat = 0
  let itemsCount = 0
  for (const doc of docs) {
    revenue += headlineExVatFromSnapshotSection(doc)
    revenueIncVat += headlineIncVatFromSnapshotSection(doc)
    itemsCount += Number(doc.totals?.quantity ?? 0)
  }
  return { revenue, revenueIncVat, itemsCount }
}

function sumLaborDocs(docs: DailyOpsSnapshotLaborSection[]) {
  let laborCost = 0
  let laborHours = 0
  const teams = new Map<string, WeeklyTeamBreakdown>()
  const workerIds = new Set<string>()

  for (const doc of docs) {
    laborCost += Number(doc.totals?.loaded_cost ?? 0)
    laborHours += Number(doc.totals?.hours ?? 0)
    for (const w of doc.workers ?? []) workerIds.add(w.userId)
    for (const team of doc.teams ?? []) {
      const key = (team.teamName ?? 'other').toLowerCase()
      const bucketKey = key === 'keuken' ? 'keuken' : key === 'bediening' ? 'bediening' : 'other'
      const prev = teams.get(bucketKey) ?? {
        key: bucketKey,
        label: bucketKey === 'keuken' ? 'Keuken' : bucketKey === 'bediening' ? 'Bediening' : 'Other',
        hours: 0,
        loadedCost: 0,
        laborCostPct: null,
      }
      prev.hours += Number(team.hours ?? 0)
      prev.loadedCost += Number(team.loaded_cost ?? 0)
      teams.set(bucketKey, prev)
    }
  }

  return { laborCost, laborHours, teams: [...teams.values()], staffCount: workerIds.size }
}

async function sumFoodBev (
  db: Db,
  _products: DailyOpsSnapshotRevenueProductsSection[],
  range: { startDate: string; endDate: string; locationId: string },
) {
  const fromCache = await sumFoodBeverageForRange(db, range)
  return { food: fromCache.food, beverage: fromCache.beverage }
}

async function buildDailyBreakdown (
  db: Db,
  dates: string[],
  revenue: DailyOpsSnapshotRevenueSection[],
  labor: DailyOpsSnapshotLaborSection[],
  products: DailyOpsSnapshotRevenueProductsSection[],
  prevRevenueByDate: Map<string, number>,
  locationId: string,
): Promise<WeeklyDayBreakdown[]> {
  const revByDate = new Map<string, { revenue: number; items: number }>()
  const labByDate = new Map<string, { cost: number; hours: number; staff: Set<string> }>()
  const foodBevByDate = new Map<string, { food: number; beverage: number }>()

  for (const doc of revenue) {
    const key = doc.businessDate
    const prev = revByDate.get(key) ?? { revenue: 0, items: 0 }
    prev.revenue += headlineExVatFromSnapshotSection(doc)
    prev.items += Number(doc.totals?.quantity ?? 0)
    revByDate.set(key, prev)
  }
  for (const doc of labor) {
    const key = doc.businessDate
    const prev = labByDate.get(key) ?? { cost: 0, hours: 0, staff: new Set<string>() }
    prev.cost += Number(doc.totals?.loaded_cost ?? 0)
    prev.hours += Number(doc.totals?.hours ?? 0)
    for (const w of doc.workers ?? []) prev.staff.add(w.userId)
    labByDate.set(key, prev)
  }
  for (const d of dates) {
    const fromCache = await sumFoodBeverageForRange(db, {
      startDate: d,
      endDate: d,
      locationId,
    })
    foodBevByDate.set(d, { food: fromCache.food, beverage: fromCache.beverage })
  }
  void products

  return dates.map((businessDate) => {
    const rev = revByDate.get(businessDate) ?? { revenue: 0, items: 0 }
    const lab = labByDate.get(businessDate) ?? { cost: 0, hours: 0, staff: new Set<string>() }
    const fb = foodBevByDate.get(businessDate) ?? { food: 0, beverage: 0 }
    const laborCostPct = rev.revenue > 0 ? roundWeekly2((lab.cost / rev.revenue) * 100) : null
    const prevWeekRevenue = prevRevenueByDate.get(addCalendarDaysYmd(businessDate, -7)) ?? null
    const prevWeekDeltaPct =
      prevWeekRevenue != null && prevWeekRevenue > 0
        ? roundWeekly2(((rev.revenue - prevWeekRevenue) / prevWeekRevenue) * 100)
        : null
    const foodCogs = fb.food * (DEFAULT_PNL_ASSUMPTIONS.foodCogsPct / 100)
    const bevCogs = fb.beverage * (DEFAULT_PNL_ASSUMPTIONS.bevCogsPct / 100)
    const overhead = rev.revenue * (DEFAULT_PNL_ASSUMPTIONS.overheadPct / 100)
    const profit = roundWeekly2(rev.revenue - lab.cost)
    const pnlResult = roundWeekly2(rev.revenue - foodCogs - bevCogs - lab.cost - overhead)
    const productivity = lab.hours > 0 ? roundWeekly2(rev.revenue / lab.hours) : null
    return {
      businessDate,
      dayOfWeek: weekdayLabel(businessDate),
      revenue: roundWeekly2(rev.revenue),
      laborCost: roundWeekly2(lab.cost),
      laborHours: roundWeekly2(lab.hours),
      laborCostPct,
      itemsCount: rev.items,
      margin: profit,
      profit,
      pnlResult,
      productivity,
      staffCount: lab.staff.size,
      prevWeekRevenue: prevWeekRevenue != null ? roundWeekly2(prevWeekRevenue) : null,
      prevWeekDeltaPct,
    }
  })
}

function buildStaffRankings(
  labor: DailyOpsSnapshotLaborSection[],
  workers: DailyOpsSnapshotRevenueWorkersSection[],
): WeeklyStaffRanking[] {
  const laborByName = new Map<string, { name: string; team: string; hours: number; cost: number }>()
  const revenueByWorker = new Map<
    string,
    { name: string; revenue: number; items: number; daily: Map<string, number> }
  >()

  const normalizeName = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, ' ')
  const isPlaceholderName = (raw: string) => {
    const n = normalizeName(raw)
    return !n || n === 'unknown' || n === 'onbekend' || n === '—'
  }

  for (const doc of labor) {
    for (const w of doc.workers ?? []) {
      const key = normalizeName(w.userName)
      if (!key || isPlaceholderName(w.userName)) continue
      const prev = laborByName.get(key) ?? {
        name: w.userName,
        team: w.teamName,
        hours: 0,
        cost: 0,
      }
      prev.hours += Number(w.hours ?? 0)
      prev.cost += Number(w.loaded_cost ?? 0)
      if (w.teamName) prev.team = w.teamName
      laborByName.set(key, prev)
    }
  }

  for (const doc of workers) {
    for (const w of doc.workers ?? []) {
      if (!w.workerId || w.workerId === 'unknown') continue
      const prev = revenueByWorker.get(w.workerId) ?? {
        name: w.workerName,
        revenue: 0,
        items: 0,
        daily: new Map<string, number>(),
      }
      if (!isPlaceholderName(w.workerName)) prev.name = w.workerName
      prev.revenue += Number(w.revenue_ex_vat ?? 0)
      prev.items += Number(w.quantity ?? 0)
      prev.daily.set(
        doc.businessDate,
        (prev.daily.get(doc.businessDate) ?? 0) + Number(w.revenue_ex_vat ?? 0),
      )
      revenueByWorker.set(w.workerId, prev)
    }
  }

  const rows: WeeklyStaffRanking[] = []
  const seenNames = new Set<string>()

  for (const [workerId, rev] of revenueByWorker) {
    const nameKey = normalizeName(rev.name)
    const lab = nameKey ? laborByName.get(nameKey) : undefined
    if (nameKey) seenNames.add(nameKey)
    const revenue = roundWeekly2(rev.revenue)
    const laborCost = roundWeekly2(lab?.cost ?? 0)
    const hours = roundWeekly2(lab?.hours ?? 0)
    if (isPlaceholderName(rev.name) && hours <= 0) continue
    rows.push({
      workerId,
      workerName: lab?.name ?? rev.name,
      teamName: lab?.team ?? '—',
      revenue,
      itemsCount: rev.items,
      hours,
      laborCost,
      revenuePerHour: hours > 0 ? roundWeekly2(revenue / hours) : null,
      laborCostPct: revenue > 0 ? roundWeekly2((laborCost / revenue) * 100) : null,
      dailyRevenue: [...rev.daily.entries()].map(([businessDate, r]) => ({
        businessDate,
        revenue: roundWeekly2(r),
      })),
    })
  }

  for (const [nameKey, lab] of laborByName) {
    if (seenNames.has(nameKey)) continue
    rows.push({
      workerId: nameKey,
      workerName: lab.name,
      teamName: lab.team,
      revenue: 0,
      itemsCount: 0,
      hours: roundWeekly2(lab.hours),
      laborCost: roundWeekly2(lab.cost),
      revenuePerHour: null,
      laborCostPct: null,
      dailyRevenue: [],
    })
  }

  return rows
    .filter((r) => r.revenue > 0 || r.hours > 0)
    .sort((a, b) => b.revenue - a.revenue || b.hours - a.hours)
    .slice(0, 50)
}

function buildHourlyLoss(revenue: DailyOpsSnapshotRevenueSection[], labor: DailyOpsSnapshotLaborSection[]): WeeklyHourlyLossCell[] {
  const cells: WeeklyHourlyLossCell[] = []
  const revMap = new Map<string, number>()
  const labMap = new Map<string, number>()

  for (const doc of revenue) {
    for (const slot of doc.hourly ?? []) {
      const key = `${doc.businessDate}|${slot.business_hour}`
      revMap.set(key, (revMap.get(key) ?? 0) + Number(slot.revenue?.ex_vat ?? 0))
    }
  }
  for (const doc of labor) {
    for (const slot of doc.hourly ?? []) {
      const key = `${doc.businessDate}|${slot.calendar_hour}`
      labMap.set(key, (labMap.get(key) ?? 0) + Number(slot.loaded_cost ?? 0))
    }
  }

  const keys = new Set([...revMap.keys(), ...labMap.keys()])
  for (const key of keys) {
    const [businessDate, hourStr] = key.split('|')
    const businessHour = Number(hourStr)
    if (!businessDate || !Number.isFinite(businessHour)) continue
    const rev = roundWeekly2(revMap.get(key) ?? 0)
    const cost = roundWeekly2(labMap.get(key) ?? 0)
    const margin = roundWeekly2(rev - cost)
    cells.push({
      businessDate,
      businessHour,
      hourLabel: hourLabelForBusinessHour(businessHour),
      revenue: rev,
      laborCost: cost,
      margin,
      status: marginStatus(margin),
    })
  }

  return cells.sort((a, b) =>
    a.businessDate === b.businessDate
      ? a.businessHour - b.businessHour
      : a.businessDate.localeCompare(b.businessDate),
  )
}

function buildSpaceMargins(
  tables: DailyOpsSnapshotRevenueTablesSection[],
  totalRevenue: number,
  totalLabor: number,
): WeeklySpaceMargin[] {
  const bySpace = new Map<string, WeeklySpaceMargin>()
  for (const doc of tables) {
    for (const t of doc.tables ?? []) {
      const key = `${t.tableNum}::${t.locationSpace}`
      const prev = bySpace.get(key) ?? {
        tableNum: t.tableNum,
        locationSpace: t.locationSpace,
        revenue: 0,
        quantity: 0,
        estimatedLaborCost: 0,
        margin: 0,
      }
      prev.revenue += Number(t.revenue_ex_vat ?? 0)
      prev.quantity += Number(t.quantity ?? 0)
      bySpace.set(key, prev)
    }
  }

  const rows = [...bySpace.values()]
  for (const row of rows) {
    const share = totalRevenue > 0 ? row.revenue / totalRevenue : 0
    row.estimatedLaborCost = roundWeekly2(totalLabor * share)
    row.revenue = roundWeekly2(row.revenue)
    row.margin = roundWeekly2(row.revenue - row.estimatedLaborCost)
  }

  return rows.sort((a, b) => b.revenue - a.revenue).slice(0, 30)
}

function buildTopProducts(products: DailyOpsSnapshotRevenueProductsSection[]): WeeklyProductRow[] {
  const byName = new Map<string, WeeklyProductRow>()
  for (const doc of products) {
    for (const p of doc.products ?? []) {
      const prev = byName.get(p.productName) ?? { productName: p.productName, revenue: 0, quantity: 0 }
      prev.revenue += Number(p.revenue_ex_vat ?? 0)
      prev.quantity += Number(p.quantity ?? 0)
      byName.set(p.productName, prev)
    }
  }
  return [...byName.values()]
    .map((r) => ({ ...r, revenue: roundWeekly2(r.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20)
}

function buildUpsell(products: DailyOpsSnapshotRevenueProductsSection[]): WeeklyUpsellMetric[] {
  const totals: Record<WeeklyUpsellMetric['key'], WeeklyUpsellMetric> = {
    water: { key: 'water', label: 'Water', quantity: 0, revenue: 0 },
    beer: { key: 'beer', label: 'Beer', quantity: 0, revenue: 0 },
    lemonade: { key: 'lemonade', label: 'Lemonade', quantity: 0, revenue: 0 },
  }
  for (const doc of products) {
    for (const p of doc.products ?? []) {
      for (const key of Object.keys(UPSell_PATTERNS) as WeeklyUpsellMetric['key'][]) {
        if (UPSell_PATTERNS[key].test(p.productName)) {
          totals[key].quantity += Number(p.quantity ?? 0)
          totals[key].revenue += Number(p.revenue_ex_vat ?? 0)
        }
      }
    }
  }
  return Object.values(totals).map((r) => ({ ...r, revenue: roundWeekly2(r.revenue) }))
}

function buildCategoryMargins(
  foodRevenue: number,
  beverageRevenue: number,
  totalRevenue: number,
  teams: WeeklyTeamBreakdown[],
  assumptions = DEFAULT_PNL_ASSUMPTIONS,
): WeeklyCategoryMargin[] {
  const keukenLabor = teams.find((t) => t.key === 'keuken')?.loadedCost ?? 0
  const bedieningLabor = teams.find((t) => t.key === 'bediening')?.loadedCost ?? 0
  const otherRevenue = Math.max(0, totalRevenue - foodRevenue - beverageRevenue)

  const foodCogs = roundWeekly2(foodRevenue * (assumptions.foodCogsPct / 100))
  const bevCogs = roundWeekly2(beverageRevenue * (assumptions.bevCogsPct / 100))
  const foodMargin = roundWeekly2(foodRevenue - foodCogs - keukenLabor)
  const bevMargin = roundWeekly2(beverageRevenue - bevCogs - bedieningLabor)
  const otherMargin = roundWeekly2(otherRevenue)

  return [
    {
      key: 'food',
      label: 'Food / Kitchen',
      revenue: roundWeekly2(foodRevenue),
      cogs: foodCogs,
      allocatedLabor: roundWeekly2(keukenLabor),
      margin: foodMargin,
      status: marginStatus(foodMargin),
    },
    {
      key: 'beverage',
      label: 'Beverages / Bar',
      revenue: roundWeekly2(beverageRevenue),
      cogs: bevCogs,
      allocatedLabor: roundWeekly2(bedieningLabor),
      margin: bevMargin,
      status: marginStatus(bevMargin),
    },
    {
      key: 'other',
      label: 'Other',
      revenue: roundWeekly2(otherRevenue),
      cogs: 0,
      allocatedLabor: 0,
      margin: otherMargin,
      status: marginStatus(otherMargin),
    },
  ]
}

type WeekTotals = {
  revenue: number
  laborCostPct: number | null
  pnlPct: number | null
  occupancyPct: number | null
}

async function readCachedWeekTotals(
  db: Db,
  range: WeeklyRange,
  locationId: string,
): Promise<WeekTotals | null> {
  const cached = await findReadCachePayload<WeeklyDigestDto>(db, {
    profile: WEEKLY_DIGEST_PROFILE,
    level: 'weekly',
    key: range.weekKey,
    locationId,
  })
  if (!cached || (cached.schemaVersion ?? 1) < 12 || !cached.tableOccupancy) return null
  return {
    revenue: cached.totals.revenue,
    laborCostPct: cached.totals.laborCostPct,
    pnlPct: cached.totals.pnlPct,
    occupancyPct: cached.tableOccupancy.occupancyPct ?? null,
  }
}

async function weekTotalsFromSnapshots(
  db: Db,
  range: WeeklyRange,
  locationId?: string,
  targets?: WeeklyTargetsDto,
): Promise<Omit<WeekTotals, 'occupancyPct'>> {
  const bundle = await fetchSnapshotBundle(db, range.startDate, range.endDate, locationId)
  const rev = sumRevenueDocs(bundle.revenue)
  const lab = sumLaborDocs(bundle.labor)
  const { food, beverage } = await sumFoodBev(db, bundle.products, {
    startDate: range.startDate,
    endDate: range.endDate,
    locationId: locationId ?? 'all',
  })
  const laborCostPct = rev.revenue > 0 ? roundWeekly2((lab.laborCost / rev.revenue) * 100) : null
  const foodCogs = food * (DEFAULT_PNL_ASSUMPTIONS.foodCogsPct / 100)
  const bevCogs = beverage * (DEFAULT_PNL_ASSUMPTIONS.bevCogsPct / 100)
  const overhead = rev.revenue * (DEFAULT_PNL_ASSUMPTIONS.overheadPct / 100)
  const pnlResult = rev.revenue - foodCogs - bevCogs - lab.laborCost - overhead
  const pnlPct = rev.revenue > 0 ? roundWeekly2((pnlResult / rev.revenue) * 100) : null
  void targets
  return {
    revenue: roundWeekly2(rev.revenue),
    laborCostPct,
    pnlPct,
  }
}

async function buildComparisons(
  db: Db,
  range: WeeklyRange,
  locationId: string,
  current: WeekTotals,
  targets: WeeklyTargetsDto,
): Promise<WeeklyCompareTrend> {
  const prevRange = previousWeekRange(range)
  const roll3 = rollingWeekRanges(range, 3)
  const roll6 = rollingWeekRanges(range, 6)
  const roll12 = rollingWeekRanges(range, 12)

  const occRangeList = [prevRange, ...roll3, ...roll6, ...roll12].map((r) => ({
    key: r.weekKey,
    startDate: r.startDate,
    endDate: r.endDate,
  }))
  const occByKey = await occupancyPctByRangeKeys(db, occRangeList, locationId)

  async function resolveTotals(r: WeeklyRange): Promise<WeekTotals> {
    const cached = await readCachedWeekTotals(db, r, locationId)
    if (cached) return cached
    const base = await weekTotalsFromSnapshots(
      db,
      r,
      locationId === 'all' ? undefined : locationId,
      targets,
    )
    return {
      ...base,
      occupancyPct: occByKey.get(r.weekKey) ?? null,
    }
  }

  const prev = await resolveTotals(prevRange)

  const totalsMemo = new Map<string, Promise<WeekTotals>>()
  function memoTotals(r: WeeklyRange): Promise<WeekTotals> {
    const hit = totalsMemo.get(r.weekKey)
    if (hit) return hit
    const p = resolveTotals(r)
    totalsMemo.set(r.weekKey, p)
    return p
  }
  totalsMemo.set(prevRange.weekKey, Promise.resolve(prev))

  async function avgRolling(ranges: WeeklyRange[]) {
    const vals = await Promise.all(ranges.map((r) => memoTotals(r)))
    const revenue = vals.length > 0 ? roundWeekly2(vals.reduce((s, v) => s + v.revenue, 0) / vals.length) : 0
    const laborPcts = vals.map((v) => v.laborCostPct).filter((v): v is number => v != null)
    const pnlPcts = vals.map((v) => v.pnlPct).filter((v): v is number => v != null)
    const occPcts = ranges
      .map((r) => occByKey.get(r.weekKey))
      .filter((v): v is number => v != null)
    return {
      avgRevenue: revenue,
      avgLaborCostPct: laborPcts.length > 0 ? roundWeekly2(laborPcts.reduce((s, v) => s + v, 0) / laborPcts.length) : null,
      avgPnlPct: pnlPcts.length > 0 ? roundWeekly2(pnlPcts.reduce((s, v) => s + v, 0) / pnlPcts.length) : null,
      avgOccupancyPct: occPcts.length > 0 ? roundWeekly2(occPcts.reduce((s, v) => s + v, 0) / occPcts.length) : null,
    }
  }

  const [rolling3, rolling6, rolling12] = await Promise.all([
    avgRolling(roll3),
    avgRolling(roll6),
    avgRolling(roll12),
  ])

  return {
    previousWeek: {
      label: prevRange.label,
      revenue: pctDelta(current.revenue, prev.revenue),
      laborCostPct: pctDelta(current.laborCostPct ?? 0, prev.laborCostPct ?? 0),
      pnlPct: pctDelta(current.pnlPct ?? 0, prev.pnlPct ?? 0),
      occupancyPct: pctDelta(current.occupancyPct ?? 0, prev.occupancyPct ?? 0),
    },
    rolling3Week: { label: '3-week avg', ...rolling3 },
    rolling6Week: { label: '6-week avg', ...rolling6 },
    rolling12Week: { label: '12-week avg', ...rolling12 },
  }
}

export async function buildWeeklyDigest(
  db: Db,
  range: WeeklyRange,
  opts: { locationId?: string; targets: WeeklyTargetsDto },
): Promise<WeeklyDigestDto> {
  const locationId = opts.locationId ?? 'all'
  const dates = enumerateDaysInclusive(range.startDate, range.endDate)
  const bundle = await fetchSnapshotBundle(db, range.startDate, range.endDate, locationId === 'all' ? undefined : locationId)

  const foundDates = new Set(bundle.masters.map((m) => m.businessDate))
  const missingDates = dates.filter((d) => !foundDates.has(d))

  const rev = sumRevenueDocs(bundle.revenue)
  const lab = sumLaborDocs(bundle.labor)
  const { food, beverage } = await sumFoodBev(db, bundle.products, {
    startDate: range.startDate,
    endDate: range.endDate,
    locationId,
  })

  const laborCostPct = rev.revenue > 0 ? roundWeekly2((lab.laborCost / rev.revenue) * 100) : null
  const revenuePerHour = lab.laborHours > 0 ? roundWeekly2(rev.revenue / lab.laborHours) : null
  const foodCogs = food * (DEFAULT_PNL_ASSUMPTIONS.foodCogsPct / 100)
  const bevCogs = beverage * (DEFAULT_PNL_ASSUMPTIONS.bevCogsPct / 100)
  const overhead = rev.revenue * (DEFAULT_PNL_ASSUMPTIONS.overheadPct / 100)
  const pnlResult = roundWeekly2(rev.revenue - foodCogs - bevCogs - lab.laborCost - overhead)
  const pnlPct = rev.revenue > 0 ? roundWeekly2((pnlResult / rev.revenue) * 100) : null

  const prevRange = previousWeekRange(range)
  const prevBundle = await fetchSnapshotBundle(
    db,
    prevRange.startDate,
    prevRange.endDate,
    locationId === 'all' ? undefined : locationId,
  )
  const prevRevByDate = new Map<string, number>()
  for (const doc of prevBundle.revenue) {
    prevRevByDate.set(
      doc.businessDate,
      (prevRevByDate.get(doc.businessDate) ?? 0) + headlineExVatFromSnapshotSection(doc),
    )
  }

  const teams = lab.teams.map((t) => ({
    ...t,
    loadedCost: roundWeekly2(t.loadedCost),
    hours: roundWeekly2(t.hours),
    laborCostPct: rev.revenue > 0 ? roundWeekly2((t.loadedCost / rev.revenue) * 100) : null,
  }))

  const currentTotals = {
    revenue: roundWeekly2(rev.revenue),
    laborCostPct,
    pnlPct,
    occupancyPct: null as number | null,
  }

  const [attendance, staffPlusmin, openingClosing, tableOccupancy] = await Promise.all([
    buildWeeklyAttendance(db, range.startDate, range.endDate, locationId),
    buildWeeklyStaffPlusmin(db, range.startDate, range.endDate, locationId),
    buildWeeklyOpeningClosing(db, range.startDate, range.endDate, locationId),
    buildWeeklyTableOccupancy(db, range.startDate, range.endDate, locationId),
  ])
  currentTotals.occupancyPct = tableOccupancy.occupancyPct
  const comparisons = await buildComparisons(db, range, locationId, currentTotals, opts.targets)

  return {
    weekKey: range.weekKey,
    label: range.label,
    startDate: range.startDate,
    endDate: range.endDate,
    locationId,
    locationName: locationNameFor(locationId),
    targets: opts.targets,
    coverage: { daysExpected: dates.length, daysFound: foundDates.size, missingDates },
    totals: {
      revenue: roundWeekly2(rev.revenue),
      revenueIncVat: roundWeekly2(rev.revenueIncVat),
      itemsCount: rev.itemsCount,
      laborCost: roundWeekly2(lab.laborCost),
      laborHours: roundWeekly2(lab.laborHours),
      laborCostPct,
      revenuePerHour,
      foodRevenue: roundWeekly2(food),
      beverageRevenue: roundWeekly2(beverage),
      pnlResult,
      pnlPct,
      staffCount: lab.staffCount,
      laborStatus: laborStatus(laborCostPct, opts.targets),
      pnlStatus: pnlStatus(pnlPct, opts.targets),
    },
    dailyBreakdown: await buildDailyBreakdown(
      db,
      dates,
      bundle.revenue,
      bundle.labor,
      bundle.products,
      prevRevByDate,
      locationId,
    ),
    teams,
    comparisons,
    staffRankings: buildStaffRankings(bundle.labor, bundle.workers),
    topProducts: buildTopProducts(bundle.products),
    upsell: buildUpsell(bundle.products),
    hourlyLoss: buildHourlyLoss(bundle.revenue, bundle.labor),
    spaceMargins: buildSpaceMargins(bundle.tables, rev.revenue, lab.laborCost),
    categoryMargins: buildCategoryMargins(food, beverage, rev.revenue, teams),
    attendance,
    staffPlusmin,
    openingClosing,
    tableOccupancy,
    dataGap: foundDates.size === 0,
    builtAt: new Date().toISOString(),
    schemaVersion: 12,
  }
}
