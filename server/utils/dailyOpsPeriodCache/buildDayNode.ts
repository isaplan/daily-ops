/**
 * @registry-id: dailyOpsPeriodCacheBuildDayNode
 * @created: 2026-08-08T21:20:00.000Z
 * @last-modified: 2026-08-09T17:30:00.000Z
 * @description: Build one day-level DailyOpsPeriodNode from sealed snapshot sections
 * @last-fix: [2026-08-09] Seal tablesByHour for Phase 7 occupancy projection
 *   Prior: [2026-08-09] Seal byWorker/byTable from snapshot workers/tables sections
 * @adr-ref: PERIOD_CACHE_ADR L2, L3
 * @data-source: snapshot-sections
 * @write-cache-json: daily_ops_period_cache · level=day
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsPeriodCache/sealDayNode.ts
 * ✓ server/utils/dailyOpsPeriodCache/cascadePeriod.ts
 * ✓ server/utils/dailyOpsPeriodCache/assembleDashboardBundleFromPeriodCache.ts
 * ✓ scripts/backfill-period-cache.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsPeriodNode,
  PeriodLeadRevenueSource,
  PeriodRatioSource,
  PeriodTableRevenueRow,
  PeriodTablesByHourRow,
  PeriodWorkerRevenueRow,
} from '~/types/daily-ops-period-cache'
import {
  DAILY_OPS_SNAPSHOT_COLLECTIONS,
  type DailyOpsSnapshotLaborSection,
  type DailyOpsSnapshotRevenueProductsSection,
  type DailyOpsSnapshotRevenueSection,
  type DailyOpsSnapshotRevenueTablesSection,
  type DailyOpsSnapshotRevenueWorkersSection,
} from '~/types/daily-ops-snapshot'
import { DEFAULT_PNL_ASSUMPTIONS } from '~/utils/dailyOpsPnlAssumptionsDefaults'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'
import {
  scaleFoodBeverageToHeadline,
  splitFromInboxCategories,
  classifyProductsWithCatalog,
} from './classifyFoodBeverage'
import { loadRatioSnapshotForDay } from './ratioSnapshot'

const PERIOD_SNAPSHOT_VERSION = 1

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function locationNameFor (locationId: string): string {
  if (locationId === 'all') return 'Combined'
  return (
    VENUE_STRIP_LOCATIONS.find((v) => v.locationId === locationId)?.locationName
    ?? locationId
  )
}

function mapLeadSource (
  lead: string | undefined,
): PeriodLeadRevenueSource {
  if (lead === 'inbox') return 'inbox_digest'
  if (lead === 'bork') return 'live_bork'
  if (lead === 'datalab_benchmark') return 'live_bork'
  return 'none'
}

function emptyLabor (): DailyOpsPeriodNode['labor'] {
  return {
    hours: 0,
    wageCost: 0,
    loadedCost: 0,
    byTeam: [],
    staffCount: 0,
  }
}

function laborFromSnapshot (
  doc: DailyOpsSnapshotLaborSection | null,
): DailyOpsPeriodNode['labor'] {
  if (!doc) return emptyLabor()
  const totals = doc.totals_gewerkt ?? doc.operational?.gewerkt ?? doc.totals
  return {
    hours: round2(Number(totals?.hours ?? 0)),
    wageCost: round2(Number(totals?.wage_cost ?? 0)),
    loadedCost: round2(Number(totals?.loaded_cost ?? 0)),
    byTeam: (doc.teams ?? []).map((t) => ({
      team: t.teamName || t.teamId,
      hours: round2(Number(t.hours ?? 0)),
      loadedCost: round2(Number(t.loaded_cost ?? 0)),
    })),
    staffCount: doc.workers?.length ?? 0,
  }
}

function staffFromSnapshot (
  doc: DailyOpsSnapshotLaborSection | null,
): DailyOpsPeriodNode['staff'] {
  if (!doc?.workers?.length) return { workers: [] }
  return {
    workers: doc.workers.map((w) => {
      const team = String(w.teamName ?? w.teamId ?? '')
      const teamLower = team.toLowerCase()
      return {
        memberId: String(w.userId ?? ''),
        hours: round2(Number(w.hours ?? 0)),
        wage: round2(Number(w.wage_cost ?? 0)),
        team,
        sick: /ziek/.test(teamLower) || undefined,
        leave: /verlof|vakantie/.test(teamLower) || undefined,
      }
    }),
  }
}

export type BuildDayNodeInput = {
  businessDate: string
  locationId: string
}

export type BuildDayNodeResult = {
  node: DailyOpsPeriodNode | null
  error?: string
}

async function loadRevenueSection (
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<DailyOpsSnapshotRevenueSection | null> {
  return db
    .collection<DailyOpsSnapshotRevenueSection>(
      DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection,
    )
    .findOne({ businessDate, locationId })
}

async function loadProductsSection (
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<DailyOpsSnapshotRevenueProductsSection | null> {
  return db
    .collection<DailyOpsSnapshotRevenueProductsSection>(
      DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection,
    )
    .findOne({ businessDate, locationId })
}

async function loadLaborSection (
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<DailyOpsSnapshotLaborSection | null> {
  return db
    .collection<DailyOpsSnapshotLaborSection>(
      DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection,
    )
    .findOne({ businessDate, locationId })
}

async function loadWorkersSection (
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<DailyOpsSnapshotRevenueWorkersSection | null> {
  return db
    .collection<DailyOpsSnapshotRevenueWorkersSection>(
      DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueWorkersSection,
    )
    .findOne({ businessDate, locationId })
}

async function loadTablesSection (
  db: Db,
  businessDate: string,
  locationId: string,
): Promise<DailyOpsSnapshotRevenueTablesSection | null> {
  return db
    .collection<DailyOpsSnapshotRevenueTablesSection>(
      DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueTablesSection,
    )
    .findOne({ businessDate, locationId })
}

function workersRevenueFromSnapshot (
  doc: DailyOpsSnapshotRevenueWorkersSection | null,
): PeriodWorkerRevenueRow[] {
  if (!doc?.workers?.length) return []
  return doc.workers.map((w) => ({
    workerId: String(w.workerId ?? ''),
    workerName: String(w.workerName ?? ''),
    exVat: round2(Number(w.revenue_ex_vat ?? 0)),
    qty: Number(w.quantity ?? 0),
    orderCount: Number(w.order_count ?? 0),
  }))
}

function tablesRevenueFromSnapshot (
  doc: DailyOpsSnapshotRevenueTablesSection | null,
): PeriodTableRevenueRow[] {
  if (!doc?.tables?.length) return []
  return doc.tables.map((t) => ({
    tableNum: String(t.tableNum ?? ''),
    locationSpace: String(t.locationSpace ?? ''),
    exVat: round2(Number(t.revenue_ex_vat ?? 0)),
    qty: Number(t.quantity ?? 0),
  }))
}

function tablesByHourFromSnapshot (
  doc: DailyOpsSnapshotRevenueTablesSection | null,
): PeriodTablesByHourRow[] {
  if (!doc?.tablesByHour?.length) return []
  return doc.tablesByHour.map((h) => ({
    hour: Number(h.calendarHour ?? h.businessHour ?? 0),
    activeTables: Number(h.activeTables ?? 0),
  }))
}

/**
 * Build a day node for one venue from existing snapshot sections.
 * Does not write — caller seals + upserts.
 */
export async function buildDayNode (
  db: Db,
  input: BuildDayNodeInput,
): Promise<BuildDayNodeResult> {
  const { businessDate, locationId } = input

  if (locationId === 'all') {
    return { node: null, error: 'Use aggregateVenueDayNodes for locationId=all' }
  }

  const [revenue, products, labor, workersSec, tablesSec] = await Promise.all([
    loadRevenueSection(db, businessDate, locationId),
    loadProductsSection(db, businessDate, locationId),
    loadLaborSection(db, businessDate, locationId),
    loadWorkersSection(db, businessDate, locationId),
    loadTablesSection(db, businessDate, locationId),
  ])

  if (!revenue) {
    return {
      node: null,
      error: `Missing revenue snapshot for ${businessDate} ${locationId}`,
    }
  }

  const exVat = round2(Number(revenue.totals?.ex_vat ?? 0))
  const incVat = round2(Number(revenue.totals?.inc_vat ?? 0))
  const vat = round2(Number(revenue.totals?.vat ?? 0))

  let food = 0
  let beverage = 0
  let byCategory: DailyOpsPeriodNode['revenue']['byCategory'] = []
  let byProductTop: DailyOpsPeriodNode['revenue']['byProductTop'] = []
  let regexFallbackProductIds: string[] = []

  const categories = products?.categories ?? []
  if (categories.length > 0) {
    const split = splitFromInboxCategories(categories)
    const scaled = scaleFoodBeverageToHeadline(exVat, split.food, split.beverage)
    food = scaled.food
    beverage = scaled.beverage
    byCategory = split.byCategory
  } else if ((products?.products ?? []).length > 0) {
    const split = await classifyProductsWithCatalog(db, products!.products, {
      range_start: businessDate,
      range_end: businessDate,
    })
    const scaled = scaleFoodBeverageToHeadline(exVat, split.food, split.beverage)
    food = scaled.food
    beverage = scaled.beverage
    byCategory = split.byCategory
    regexFallbackProductIds = split.regexFallbackProductIds
    byProductTop = split.classified
      .slice()
      .sort((a, b) => b.exVat - a.exVat)
      .slice(0, 50)
      .map((p) => ({
        productId: p.productId,
        name: p.productName,
        exVat: p.exVat,
        qty: p.qty,
      }))
  }

  if (byProductTop.length === 0 && products?.products?.length) {
    byProductTop = products.products
      .slice(0, 50)
      .map((p) => ({
        productId: p.productId,
        name: p.productName,
        exVat: round2(p.revenue_ex_vat),
        qty: p.quantity,
      }))
  }

  const byHour = (revenue.hourly ?? []).map((h) => ({
    hour: h.business_hour,
    exVat: round2(Number(h.revenue?.ex_vat ?? 0)),
    qty: Number(h.quantity ?? 0),
  }))
  const byWorker = workersRevenueFromSnapshot(workersSec)
  const byTable = tablesRevenueFromSnapshot(tablesSec)
  const tablesByHour = tablesByHourFromSnapshot(tablesSec)

  const laborBlock = laborFromSnapshot(labor)
  const staffBlock = staffFromSnapshot(labor)
  const ratioSnap = await loadRatioSnapshotForDay(db, businessDate, locationId)

  const foodCogsPct = ratioSnap?.foodCogsPct ?? DEFAULT_PNL_ASSUMPTIONS.foodCogsPct
  const bevCogsPct = ratioSnap?.bevCogsPct ?? DEFAULT_PNL_ASSUMPTIONS.bevCogsPct
  const cogsAmount = round2(
    food * (foodCogsPct / 100) + beverage * (bevCogsPct / 100),
  )
  const cogsPct = exVat > 0
    ? round2((cogsAmount / exVat) * 100)
    : (ratioSnap?.cogsPct ?? 0)

  const loadedCost = laborBlock.loadedCost
  const laborPct = exVat > 0 ? round2((loadedCost / exVat) * 100) : 0
  const fixedLaborPct = ratioSnap?.fixedLaborPct ?? 0
  const flexLaborPct = ratioSnap?.flexLaborPct ?? 0
  const breakEven = ratioSnap?.breakEvenMonthly
    ? round2(ratioSnap.breakEvenMonthly / 30)
    : 0
  const cm = 1 - cogsPct / 100 - flexLaborPct / 100
  const netProfit = breakEven > 0 && cm > 0
    ? round2((exVat - breakEven) * cm)
    : round2(exVat - loadedCost - cogsAmount)

  const ratioSource: PeriodRatioSource = ratioSnap?.source === 'finance_sealed'
    ? 'finance_sealed'
    : ratioSnap?.source === 'rolling_12m'
      ? 'rolling_12m'
      : 'default'

  const node: DailyOpsPeriodNode = {
    schemaVersion: 1,
    locationId,
    locationName: revenue.locationName || locationNameFor(locationId),
    level: 'day',
    periodKey: businessDate,
    businessDateStart: businessDate,
    businessDateEnd: businessDate,
    status: 'ops_sealed',
    revenue: {
      exVat,
      incVat,
      vat,
      food,
      beverage,
      byCategory,
      byProductTop,
      byHour,
      byWorker,
      byTable,
      tablesByHour,
      leadSource: mapLeadSource(revenue.leadSource),
    },
    labor: laborBlock,
    staff: staffBlock,
    cogs: {
      foodPct: foodCogsPct,
      bevPct: bevCogsPct,
      amount: cogsAmount,
    },
    ratios: {
      laborPct,
      fixedLaborPct,
      flexLaborPct,
      cogsPct,
      breakEven,
      netProfit,
      source: ratioSource,
      ratioAsOf: ratioSnap?.monthKey ?? 'default',
    },
    childKeys: [],
    provenance: {
      builtFrom: [
        DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection,
        DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueProductsSection,
        DAILY_OPS_SNAPSHOT_COLLECTIONS.laborSection,
        DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueWorkersSection,
        DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueTablesSection,
      ],
      lastBuiltAt: new Date().toISOString(),
      snapshotVersion: PERIOD_SNAPSHOT_VERSION,
      regexFallbackProductIds,
    },
  }

  return { node }
}

/** Sum three venue day nodes into locationId=all. */
export function aggregateVenueDayNodes (
  venues: DailyOpsPeriodNode[],
  businessDate: string,
): DailyOpsPeriodNode {
  let exVat = 0
  let incVat = 0
  let vat = 0
  let food = 0
  let beverage = 0
  let hours = 0
  let wageCost = 0
  let loadedCost = 0
  let staffCount = 0
  let cogsAmount = 0
  const regexIds = new Set<string>()
  const byTeamMap = new Map<string, { hours: number; loadedCost: number }>()
  const workerRevMap = new Map<string, PeriodWorkerRevenueRow>()
  const tableRevMap = new Map<string, PeriodTableRevenueRow>()
  const staffWorkerMap = new Map<string, DailyOpsPeriodNode['staff']['workers'][number]>()

  for (const v of venues) {
    exVat += v.revenue.exVat
    incVat += v.revenue.incVat
    vat += v.revenue.vat
    food += v.revenue.food
    beverage += v.revenue.beverage
    hours += v.labor.hours
    wageCost += v.labor.wageCost
    loadedCost += v.labor.loadedCost
    staffCount += v.labor.staffCount
    cogsAmount += v.cogs.amount
    for (const id of v.provenance.regexFallbackProductIds ?? []) regexIds.add(id)
    for (const t of v.labor.byTeam) {
      const prev = byTeamMap.get(t.team) ?? { hours: 0, loadedCost: 0 }
      prev.hours += t.hours
      prev.loadedCost += t.loadedCost
      byTeamMap.set(t.team, prev)
    }
    for (const w of v.revenue.byWorker ?? []) {
      const key = w.workerId || w.workerName
      if (!key) continue
      const prev = workerRevMap.get(key)
      if (prev) {
        prev.exVat = round2(prev.exVat + w.exVat)
        prev.qty += w.qty
        prev.orderCount += w.orderCount
      } else {
        workerRevMap.set(key, { ...w })
      }
    }
    for (const t of v.revenue.byTable ?? []) {
      const key = `${t.tableNum}|${t.locationSpace}`
      const prev = tableRevMap.get(key)
      if (prev) {
        prev.exVat = round2(prev.exVat + t.exVat)
        prev.qty += t.qty
      } else {
        tableRevMap.set(key, { ...t })
      }
    }
    for (const w of v.staff.workers ?? []) {
      const key = w.memberId || `${w.team}|${w.hours}`
      if (!key) continue
      const prev = staffWorkerMap.get(key)
      if (prev) {
        prev.hours = round2(prev.hours + w.hours)
        prev.wage = round2(prev.wage + w.wage)
      } else {
        staffWorkerMap.set(key, { ...w })
      }
    }
  }

  const first = venues[0]
  const breakEven = venues.reduce((s, v) => s + v.ratios.breakEven, 0)
  const netProfit = venues.reduce((s, v) => s + v.ratios.netProfit, 0)
  const laborPct = exVat > 0 ? round2((loadedCost / exVat) * 100) : 0
  const cogsPct = exVat > 0 ? round2((cogsAmount / exVat) * 100) : 0

  return {
    schemaVersion: 1,
    locationId: 'all',
    locationName: 'Combined',
    level: 'day',
    periodKey: businessDate,
    businessDateStart: businessDate,
    businessDateEnd: businessDate,
    status: venues.every((v) => v.status === 'ops_sealed' || v.status === 'finance_sealed')
      ? 'ops_sealed'
      : venues.some((v) => v.status === 'open')
        ? 'open'
        : 'partial',
    revenue: {
      exVat: round2(exVat),
      incVat: round2(incVat),
      vat: round2(vat),
      food: round2(food),
      beverage: round2(beverage),
      byCategory: [],
      byProductTop: [],
      byHour: [],
      byWorker: [...workerRevMap.values()],
      byTable: [...tableRevMap.values()],
      tablesByHour: [],
      leadSource: first?.revenue.leadSource ?? 'none',
    },
    labor: {
      hours: round2(hours),
      wageCost: round2(wageCost),
      loadedCost: round2(loadedCost),
      byTeam: Array.from(byTeamMap.entries()).map(([team, v]) => ({
        team,
        hours: round2(v.hours),
        loadedCost: round2(v.loadedCost),
      })),
      staffCount,
    },
    staff: { workers: [...staffWorkerMap.values()] },
    cogs: {
      foodPct: first?.cogs.foodPct ?? DEFAULT_PNL_ASSUMPTIONS.foodCogsPct,
      bevPct: first?.cogs.bevPct ?? DEFAULT_PNL_ASSUMPTIONS.bevCogsPct,
      amount: round2(cogsAmount),
    },
    ratios: {
      laborPct,
      fixedLaborPct: first?.ratios.fixedLaborPct ?? 0,
      flexLaborPct: first?.ratios.flexLaborPct ?? 0,
      cogsPct,
      breakEven: round2(breakEven),
      netProfit: round2(netProfit),
      source: first?.ratios.source ?? 'default',
      ratioAsOf: first?.ratios.ratioAsOf ?? 'default',
    },
    childKeys: venues.map((v) => v.locationId),
    provenance: {
      builtFrom: venues.map((v) => `day:${v.locationId}:${businessDate}`),
      lastBuiltAt: new Date().toISOString(),
      snapshotVersion: PERIOD_SNAPSHOT_VERSION,
      regexFallbackProductIds: [...regexIds],
    },
  }
}
