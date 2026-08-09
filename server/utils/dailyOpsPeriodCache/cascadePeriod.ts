/**
 * @registry-id: dailyOpsPeriodCacheCascade
 * @created: 2026-08-08T21:20:00.000Z
 * @last-modified: 2026-08-08T21:20:00.000Z
 * @description: Day → week → month → year cascade for daily_ops_period_cache
 * @last-fix: [2026-08-09] @adr-ref → PERIOD_CACHE_ADR L2
 * @adr-ref: PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @write-cache-json: daily_ops_period_cache · day→week→month→year
 *
 * @exports-to:
 * ✓ scripts/backfill-period-cache.ts
 * ✓ server/utils/dailyOpsPeriodCache/resolvePeriodRange.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsPeriodNode,
  DailyOpsPeriodStatus,
} from '~/types/daily-ops-period-cache'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import {
  getIsoWeek,
  getMonthKey,
  getWeekEnd,
  getWeekStart,
  getYearKey,
  monthEndYmd,
} from '../dailyOpsSnapshot/aggregateDailyBundles'
import { findPeriodNode, upsertPeriodNode } from './store'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function emptyDetailRevenue (
  base: DailyOpsPeriodNode['revenue'],
): DailyOpsPeriodNode['revenue'] {
  return {
    ...base,
    byCategory: [],
    byProductTop: [],
    byHour: [],
    byWorker: [],
    byTable: [],
    tablesByHour: [],
  }
}

function mergeStatus (statuses: DailyOpsPeriodStatus[]): DailyOpsPeriodStatus {
  if (statuses.length === 0) return 'partial'
  if (statuses.every((s) => s === 'finance_sealed')) return 'finance_sealed'
  if (statuses.every((s) => s === 'ops_sealed' || s === 'finance_sealed')) {
    return 'ops_sealed'
  }
  if (statuses.some((s) => s === 'open')) return 'open'
  return 'partial'
}

function aggregateChildNodes (
  children: DailyOpsPeriodNode[],
  opts: {
    locationId: string
    locationName: string
    level: 'week' | 'month' | 'year'
    periodKey: string
    startDate: string
    endDate: string
    childKeys: string[]
  },
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
  let breakEven = 0
  let netProfit = 0
  const regexIds = new Set<string>()
  const byTeamMap = new Map<string, { hours: number; loadedCost: number }>()

  for (const c of children) {
    exVat += c.revenue.exVat
    incVat += c.revenue.incVat
    vat += c.revenue.vat
    food += c.revenue.food
    beverage += c.revenue.beverage
    hours += c.labor.hours
    wageCost += c.labor.wageCost
    loadedCost += c.labor.loadedCost
    staffCount += c.labor.staffCount
    cogsAmount += c.cogs.amount
    breakEven += c.ratios.breakEven
    netProfit += c.ratios.netProfit
    for (const id of c.provenance.regexFallbackProductIds ?? []) regexIds.add(id)
    for (const t of c.labor.byTeam) {
      const prev = byTeamMap.get(t.team) ?? { hours: 0, loadedCost: 0 }
      prev.hours += t.hours
      prev.loadedCost += t.loadedCost
      byTeamMap.set(t.team, prev)
    }
  }

  const first = children[0]!
  const laborPct = exVat > 0 ? round2((loadedCost / exVat) * 100) : 0
  const cogsPct = exVat > 0 ? round2((cogsAmount / exVat) * 100) : 0

  return {
    schemaVersion: 1,
    locationId: opts.locationId,
    locationName: opts.locationName,
    level: opts.level,
    periodKey: opts.periodKey,
    businessDateStart: opts.startDate,
    businessDateEnd: opts.endDate,
    status: mergeStatus(children.map((c) => c.status)),
    revenue: emptyDetailRevenue({
      exVat: round2(exVat),
      incVat: round2(incVat),
      vat: round2(vat),
      food: round2(food),
      beverage: round2(beverage),
      byCategory: [],
      byProductTop: [],
      byHour: [],
      leadSource: first.revenue.leadSource,
    }),
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
    staff: { workers: [] },
    cogs: {
      foodPct: first.cogs.foodPct,
      bevPct: first.cogs.bevPct,
      amount: round2(cogsAmount),
    },
    ratios: {
      laborPct,
      fixedLaborPct: first.ratios.fixedLaborPct,
      flexLaborPct: first.ratios.flexLaborPct,
      cogsPct,
      breakEven: round2(breakEven),
      netProfit: round2(netProfit),
      source: first.ratios.source,
      ratioAsOf: first.ratios.ratioAsOf,
    },
    childKeys: opts.childKeys,
    provenance: {
      builtFrom: children.map((c) => `${c.level}:${c.periodKey}`),
      lastBuiltAt: new Date().toISOString(),
      snapshotVersion: 1,
      regexFallbackProductIds: [...regexIds],
    },
  }
}

async function loadDayNodes (
  db: Db,
  startDate: string,
  endDate: string,
  locationId: string,
): Promise<DailyOpsPeriodNode[]> {
  const out: DailyOpsPeriodNode[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    const hit = await findPeriodNode(db, {
      locationId,
      level: 'day',
      periodKey: cursor,
    })
    if (hit) out.push(hit)
    cursor = addCalendarDaysYmd(cursor, 1)
  }
  return out
}

export async function generateWeekNode (
  db: Db,
  weekKey: string,
  weekStart: string,
  locationId: string,
): Promise<{ written: boolean; error?: string }> {
  const weekEnd = getWeekEnd(weekStart)
  const days = await loadDayNodes(db, weekStart, weekEnd, locationId)
  if (days.length < 7) {
    return {
      written: false,
      error: `Incomplete week ${weekKey} ${locationId}: ${days.length}/7 days`,
    }
  }
  const locationName = days[0]?.locationName ?? locationId
  const node = aggregateChildNodes(days, {
    locationId,
    locationName,
    level: 'week',
    periodKey: weekKey,
    startDate: weekStart,
    endDate: weekEnd,
    childKeys: days.map((d) => d.periodKey),
  })
  await upsertPeriodNode(db, node)
  return { written: true }
}

export async function generateMonthNode (
  db: Db,
  monthKey: string,
  locationId: string,
): Promise<{ written: boolean; error?: string }> {
  const startDate = `${monthKey}-01`
  const endDate = monthEndYmd(monthKey)
  const days = await loadDayNodes(db, startDate, endDate, locationId)
  if (days.length === 0) {
    return { written: false, error: `No days for ${monthKey} ${locationId}` }
  }
  const locationName = days[0]?.locationName ?? locationId
  const node = aggregateChildNodes(days, {
    locationId,
    locationName,
    level: 'month',
    periodKey: monthKey,
    startDate,
    endDate,
    childKeys: days.map((d) => d.periodKey),
  })
  await upsertPeriodNode(db, node)
  return { written: true }
}

export async function generateYearNode (
  db: Db,
  yearKey: string,
  locationId: string,
): Promise<{ written: boolean; error?: string }> {
  const months: DailyOpsPeriodNode[] = []
  const childKeys: string[] = []
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${yearKey}-${String(m).padStart(2, '0')}`
    const hit = await findPeriodNode(db, {
      locationId,
      level: 'month',
      periodKey: monthKey,
    })
    if (hit) {
      months.push(hit)
      childKeys.push(monthKey)
    }
  }
  if (months.length === 0) {
    return { written: false, error: `No months for ${yearKey} ${locationId}` }
  }
  const locationName = months[0]?.locationName ?? locationId
  const node = aggregateChildNodes(months, {
    locationId,
    locationName,
    level: 'year',
    periodKey: yearKey,
    startDate: `${yearKey}-01-01`,
    endDate: `${yearKey}-12-31`,
    childKeys,
  })
  // Partial year until all 12 months present
  if (months.length < 12) {
    node.status = 'partial'
  }
  await upsertPeriodNode(db, node)
  return { written: true }
}

export type CascadePeriodResult = {
  weekly: number
  monthly: number
  yearly: number
  errors: string[]
}

/** Cascade week/month/year for all locations covering [startDate, endDate]. */
export async function cascadePeriodRange (
  db: Db,
  startDate: string,
  endDate: string,
  locationIds?: string[],
): Promise<CascadePeriodResult> {
  const locs = locationIds ?? [
    ...VENUE_STRIP_LOCATIONS.map((v) => v.locationId),
    'all',
  ]

  const weeks = new Set<string>()
  const months = new Set<string>()
  const years = new Set<string>()
  let cursor = startDate
  while (cursor <= endDate) {
    weeks.add(getIsoWeek(cursor))
    months.add(getMonthKey(cursor))
    years.add(getYearKey(cursor))
    cursor = addCalendarDaysYmd(cursor, 1)
  }

  let weekly = 0
  let monthly = 0
  let yearly = 0
  const errors: string[] = []

  for (const week of weeks) {
    for (const locationId of locs) {
      let weekStart = startDate
      let c = startDate
      while (c <= endDate) {
        if (getIsoWeek(c) === week) {
          weekStart = getWeekStart(c)
          break
        }
        c = addCalendarDaysYmd(c, 1)
      }
      const result = await generateWeekNode(db, week, weekStart, locationId)
      if (result.written) weekly++
      else if (result.error && !result.error.includes('Incomplete week')) {
        errors.push(result.error)
      }
    }
  }

  for (const month of months) {
    for (const locationId of locs) {
      const result = await generateMonthNode(db, month, locationId)
      if (result.written) monthly++
      else if (result.error) errors.push(result.error)
    }
  }

  for (const year of years) {
    for (const locationId of locs) {
      const result = await generateYearNode(db, year, locationId)
      if (result.written) yearly++
      else if (result.error) errors.push(result.error)
    }
  }

  return { weekly, monthly, yearly, errors }
}
