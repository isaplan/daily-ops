/**
 * @registry-id: dailyOpsSnapshotBuildRevenueDrilldownSection
 * @created: 2026-05-26T02:36:00.000Z
 * @last-modified: 2026-05-26T02:55:00.000Z
 * @description: Builds snapshot-backed Daily Ops revenue drilldown data for the dashboard.
 * @last-fix: [2026-05-26] Benchmark medians fall back to main revenue snapshot hourly rows.
 *   Prior: [2026-05-26] Initial modular drilldown builder below Most Profitable Hour.
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsRevenueDrilldownDto,
  DailyOpsRevenueDrilldownHourlyRowDto,
  DailyOpsRevenueDrilldownStatus,
  DailyOpsRevenueDrilldownTopRowDto,
} from '~/types/daily-ops-dashboard'
import {
  DAILY_OPS_SNAPSHOT_COLLECTIONS,
  type DailyOpsSnapshotRevenueHourlySection,
  type DailyOpsSnapshotRevenueProductsSection,
  type DailyOpsSnapshotRevenueSection,
  type DailyOpsSnapshotRevenueTablesSection,
  type DailyOpsSnapshotRevenueWorkersSection,
} from '~/types/daily-ops-snapshot'
import {
  MOST_PROFITABLE_HOUR_DEFAULTS,
  MOST_PROFITABLE_HOUR_ESTIMATES_NOTE,
  type DailyOpsMetricsContext,
} from '../dailyOpsDashboardMetrics'
import { VENUE_STRIP_LOCATIONS } from '../dailyOpsVenueStrip'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'

type LaborBucket = { loadedCost: number; hours: number }

type BuildRevenueDrilldownInput = {
  revenue: DailyOpsSnapshotRevenueSection[]
  hourly: DailyOpsSnapshotRevenueHourlySection[]
  products: DailyOpsSnapshotRevenueProductsSection[]
  tables: DailyOpsSnapshotRevenueTablesSection[]
  workers: DailyOpsSnapshotRevenueWorkersSection[]
  laborByLocHour: Map<string, LaborBucket>
  headlineRevenueByLocDay: Map<string, number>
  categoryTotals: { food: number; drinks: number }
}

const DRINK_NAME_PATTERN =
  /wine|wijn|beer|bier|gint|gin |vodka|whisk|whiskey|rum|cocktail|cola|sprite|fanta|coffee|koffie|thee|tea|sap|juice|fris|prosecco|champagne|cider|tonic|latte|cappuccino|espresso|pils|stelz|borrel|aperol|campari|martini|soda|limonade/i

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

function locDayKey(date: string, locationId: string): string {
  return `${date}|${locationId}`
}

function locHourKey(locationId: string, date: string, hour: number): string {
  return `${locationId}|${date}|${hour}`
}

function dateWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

function sameWeekdayLookbackDates(date: string, count: number): string[] {
  const out: string[] = []
  let cursor = date
  for (let i = 0; i < count; i += 1) {
    cursor = addCalendarDaysYmd(cursor, -7)
    out.push(cursor)
  }
  return out
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const hi = sorted[mid] ?? 0
  if (sorted.length % 2 === 1) return hi
  const lo = sorted[mid - 1] ?? hi
  return (lo + hi) / 2
}

function benchmarkStatus(revenue: number, benchmark: number | null): DailyOpsRevenueDrilldownStatus {
  if (benchmark == null || benchmark <= 0 || revenue === 0) return 'neutral'
  return revenue >= benchmark ? 'above' : 'below'
}

function pushTopRow(
  map: Map<string, DailyOpsRevenueDrilldownTopRowDto>,
  key: string,
  row: DailyOpsRevenueDrilldownTopRowDto,
): void {
  const prev = map.get(key)
  if (!prev) {
    map.set(key, { ...row, revenue: round2(row.revenue), quantity: row.quantity, count: row.count })
    return
  }
  prev.revenue = round2(prev.revenue + row.revenue)
  prev.quantity += row.quantity
  prev.count = (prev.count ?? 0) + (row.count ?? 0)
}

function topRows(map: Map<string, DailyOpsRevenueDrilldownTopRowDto>, limit = 10): DailyOpsRevenueDrilldownTopRowDto[] {
  return [...map.values()]
    .map((row) => ({ ...row, revenue: round2(row.revenue) }))
    .sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function revenueScale(
  date: string,
  locationId: string,
  rawByLocDay: Map<string, number>,
  headlineRevenueByLocDay: Map<string, number>,
): number {
  const key = locDayKey(date, locationId)
  const raw = rawByLocDay.get(key) ?? 0
  const target = headlineRevenueByLocDay.get(key) ?? 0
  if (raw > 0 && target > 0) return target / raw
  return 1
}

async function loadHourlyBenchmarks(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<Map<number, number>> {
  if (ctx.startDate !== ctx.endDate) return new Map()
  const lookbackDates = sameWeekdayLookbackDates(ctx.startDate, 5)
  const expectedWeekday = dateWeekday(ctx.startDate)
  const filter: Record<string, unknown> = { businessDate: { $in: lookbackDates } }
  if (ctx.locationId) filter.locationId = ctx.locationId
  const [hourlyDocs, revenueDocs] = await Promise.all([
    db
      .collection<DailyOpsSnapshotRevenueHourlySection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueHourlySection)
      .find(filter)
      .toArray(),
    db
      .collection<DailyOpsSnapshotRevenueSection>(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection)
      .find(filter)
      .toArray(),
  ])

  const valuesByHour = new Map<number, number[]>()
  const dayHourTotals = new Map<string, number>()
  const coveredLocDays = new Set(hourlyDocs.map((doc) => locDayKey(doc.businessDate, doc.locationId)))
  const benchmarkDocs = [
    ...hourlyDocs.map((doc) => ({
      businessDate: doc.businessDate,
      locationId: doc.locationId,
      hourly: doc.hourly,
    })),
    ...revenueDocs
      .filter((doc) => !coveredLocDays.has(locDayKey(doc.businessDate, doc.locationId)))
      .map((doc) => ({
        businessDate: doc.businessDate,
        locationId: doc.locationId,
        hourly: doc.hourly,
      })),
  ]

  for (const doc of benchmarkDocs) {
    if (dateWeekday(doc.businessDate) !== expectedWeekday) continue
    for (const slot of doc.hourly ?? []) {
      const hour = Number(slot.calendar_hour)
      const revenue = Number(slot.revenue?.ex_vat ?? 0)
      if (!Number.isFinite(hour) || revenue <= 0) continue
      const key = `${doc.businessDate}|${hour}`
      dayHourTotals.set(key, (dayHourTotals.get(key) ?? 0) + revenue)
    }
  }
  for (const [key, revenue] of dayHourTotals) {
    const [, hourRaw = ''] = key.split('|')
    const hour = Number(hourRaw)
    if (!Number.isFinite(hour)) continue
    const values = valuesByHour.get(hour) ?? []
    values.push(revenue)
    valuesByHour.set(hour, values)
  }

  const out = new Map<number, number>()
  for (const [hour, values] of valuesByHour) {
    const m = median(values)
    if (m != null) out.set(hour, round2(m))
  }
  return out
}

function buildHourlyRows(
  ctx: DailyOpsMetricsContext,
  input: BuildRevenueDrilldownInput,
  hourlyBenchmarks: Map<number, number>,
): DailyOpsRevenueDrilldownHourlyRowDto[] {
  const rawByLocDay = new Map<string, number>()
  for (const doc of input.hourly) {
    for (const slot of doc.hourly ?? []) {
      rawByLocDay.set(
        locDayKey(doc.businessDate, doc.locationId),
        (rawByLocDay.get(locDayKey(doc.businessDate, doc.locationId)) ?? 0) + Number(slot.revenue?.ex_vat ?? 0),
      )
    }
  }

  const byHourLoc = new Map<string, { locationName: string; revenue: number; laborCost: number }>()
  for (const doc of input.hourly) {
    if (doc.businessDate < ctx.startDate || doc.businessDate > ctx.endDate) continue
    const scale = revenueScale(doc.businessDate, doc.locationId, rawByLocDay, input.headlineRevenueByLocDay)
    for (const slot of doc.hourly ?? []) {
      const hour = Number(slot.calendar_hour)
      if (!Number.isFinite(hour)) continue
      const key = `${hour}|${doc.locationId}`
      const prev = byHourLoc.get(key) ?? { locationName: doc.locationName, revenue: 0, laborCost: 0 }
      prev.revenue += Number(slot.revenue?.ex_vat ?? 0) * scale
      prev.laborCost += input.laborByLocHour.get(locHourKey(doc.locationId, doc.businessDate, hour))?.loadedCost ?? 0
      byHourLoc.set(key, prev)
    }
  }

  const catTotal = input.categoryTotals.food + input.categoryTotals.drinks
  const foodShare = catTotal > 0 ? input.categoryTotals.food / catTotal : 0.5
  const rows: DailyOpsRevenueDrilldownHourlyRowDto[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    const locations = VENUE_STRIP_LOCATIONS.map((location) => {
      const found = byHourLoc.get(`${hour}|${location.locationId}`)
      const revenue = round2(found?.revenue ?? 0)
      const laborCost = round2(found?.laborCost ?? 0)
      const foodRev = revenue * foodShare
      const bevRev = revenue - foodRev
      const cogsCost = round2(
        foodRev * MOST_PROFITABLE_HOUR_DEFAULTS.foodCogsPct +
        bevRev * MOST_PROFITABLE_HOUR_DEFAULTS.beverageCogsPct,
      )
      const fixedCost = round2(revenue * MOST_PROFITABLE_HOUR_DEFAULTS.fixedOverheadPct)
      return {
        locationId: location.locationId,
        locationName: found?.locationName ?? location.locationName,
        revenue,
        laborCost,
        profit: round2(revenue - laborCost - cogsCost - fixedCost),
      }
    })
    const revenue = round2(locations.reduce((sum, row) => sum + row.revenue, 0))
    const laborCost = round2(locations.reduce((sum, row) => sum + row.laborCost, 0))
    const foodRev = revenue * foodShare
    const bevRev = revenue - foodRev
    const cogsCost = round2(
      foodRev * MOST_PROFITABLE_HOUR_DEFAULTS.foodCogsPct +
      bevRev * MOST_PROFITABLE_HOUR_DEFAULTS.beverageCogsPct,
    )
    const fixedCost = round2(revenue * MOST_PROFITABLE_HOUR_DEFAULTS.fixedOverheadPct)
    const benchmarkRevenue = hourlyBenchmarks.get(hour) ?? null
    rows.push({
      calendarHour: hour,
      hourLabel: hourLabel(hour),
      revenue,
      laborCost,
      cogsCost,
      fixedCost,
      profit: round2(revenue - laborCost - cogsCost - fixedCost),
      benchmarkRevenue,
      benchmarkDelta: benchmarkRevenue != null ? round2(revenue - benchmarkRevenue) : null,
      benchmarkStatus: benchmarkStatus(revenue, benchmarkRevenue),
      locations,
    })
  }
  return rows
}

function buildSpaces(input: BuildRevenueDrilldownInput): DailyOpsRevenueDrilldownDto['spaces'] {
  const venueTotals = new Map<string, number>()
  const spaces = new Map<string, { locationId: string; locationName: string; spaceName: string; revenue: number; quantity: number }>()
  for (const doc of input.tables) {
    for (const table of doc.tables ?? []) {
      const revenue = Number(table.revenue_ex_vat ?? 0)
      const quantity = Number(table.quantity ?? 0)
      venueTotals.set(doc.locationId, (venueTotals.get(doc.locationId) ?? 0) + revenue)
      const spaceName = String(table.locationSpace ?? '').trim() || 'Unknown'
      const key = `${doc.locationId}|${spaceName}`
      const prev = spaces.get(key) ?? { locationId: doc.locationId, locationName: doc.locationName, spaceName, revenue: 0, quantity: 0 }
      prev.revenue += revenue
      prev.quantity += quantity
      spaces.set(key, prev)
    }
  }
  return [...spaces.values()]
    .map((space) => ({
      locationId: space.locationId,
      locationName: space.locationName,
      spaceName: space.spaceName,
      revenue: round2(space.revenue),
      quantity: round2(space.quantity),
      pctOfVenueRevenue: (venueTotals.get(space.locationId) ?? 0) > 0
        ? round2((space.revenue / (venueTotals.get(space.locationId) ?? 1)) * 100)
        : null,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

function buildTop10(input: BuildRevenueDrilldownInput): DailyOpsRevenueDrilldownDto['top10'] {
  const workers = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()
  const tables = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()
  const foodProducts = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()
  const beverages = new Map<string, DailyOpsRevenueDrilldownTopRowDto>()

  for (const doc of input.workers) {
    for (const worker of doc.workers ?? []) {
      const label = String(worker.workerName ?? '').trim() || 'Unknown'
      pushTopRow(workers, String(worker.workerId ?? label), {
        label,
        subLabel: doc.locationName,
        revenue: Number(worker.revenue_ex_vat ?? 0),
        quantity: Number(worker.quantity ?? 0),
        count: Number(worker.order_count ?? 0),
      })
    }
  }
  for (const doc of input.tables) {
    for (const table of doc.tables ?? []) {
      const label = String(table.tableNum ?? '').trim() || 'Unknown table'
      const spaceName = String(table.locationSpace ?? '').trim()
      pushTopRow(tables, `${doc.locationId}|${label}|${spaceName}`, {
        label,
        subLabel: [doc.locationName, spaceName].filter(Boolean).join(' · '),
        revenue: Number(table.revenue_ex_vat ?? 0),
        quantity: Number(table.quantity ?? 0),
      })
    }
  }
  for (const doc of input.products) {
    for (const product of doc.products ?? []) {
      const label = String(product.productName ?? '').trim() || 'Unknown product'
      const target = DRINK_NAME_PATTERN.test(label) ? beverages : foodProducts
      pushTopRow(target, label, {
        label,
        subLabel: doc.locationName,
        revenue: Number(product.revenue_ex_vat ?? 0),
        quantity: Number(product.quantity ?? 0),
      })
    }
    for (const category of doc.categories ?? []) {
      const label = String(category.name ?? '').trim() || 'Unknown category'
      if (!DRINK_NAME_PATTERN.test(label)) continue
      pushTopRow(beverages, `category|${label}`, {
        label,
        subLabel: `${doc.locationName} · category`,
        revenue: Number(category.revenue_ex_vat ?? 0),
        quantity: Number(category.quantity ?? 0),
      })
    }
  }

  return {
    workers: topRows(workers),
    tables: topRows(tables),
    foodProducts: topRows(foodProducts),
    beverageProductsOrCategories: topRows(beverages),
  }
}

export async function buildRevenueDrilldownSection(
  db: Db,
  ctx: DailyOpsMetricsContext,
  input: BuildRevenueDrilldownInput,
): Promise<DailyOpsRevenueDrilldownDto> {
  const hourlyBenchmarks = await loadHourlyBenchmarks(db, ctx)
  const hourlyRows = buildHourlyRows(ctx, input, hourlyBenchmarks)
  const spaces = buildSpaces(input)
  const top10 = buildTop10(input)
  const coverageNotes: string[] = []
  const activeRevenueHourCount = hourlyRows.filter((row) => row.revenue > 0).length
  const benchmarkedActiveHourCount = hourlyRows.filter((row) => row.revenue > 0 && row.benchmarkRevenue != null).length

  if (input.hourly.length === 0) coverageNotes.push('No hourly revenue snapshot rows for this range.')
  if (hourlyBenchmarks.size === 0) coverageNotes.push('No last-5 same-weekday hourly benchmark available yet.')
  else if (benchmarkedActiveHourCount < activeRevenueHourCount) {
    coverageNotes.push(
      `Hourly benchmark covers ${benchmarkedActiveHourCount} of ${activeRevenueHourCount} active revenue hours.`,
    )
  }
  if (input.tables.length === 0) coverageNotes.push('No table/space revenue snapshot rows for this range.')
  if (input.workers.length === 0) coverageNotes.push('No worker revenue snapshot rows for this range.')
  if (input.products.length === 0) coverageNotes.push('No product/category revenue snapshot rows for this range.')

  return {
    estimatesNote: MOST_PROFITABLE_HOUR_ESTIMATES_NOTE,
    coverageNotes,
    hourlyRows,
    spaces,
    top10,
  }
}
