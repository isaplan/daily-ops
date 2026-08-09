/**
 * @registry-id: dailyOpsRevenueFetchRange
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-08-09T00:45:00.000Z
 * @description: Revenue + items for a date range — period-cache day nodes (GET)
 * @last-fix: [2026-08-09] Prefer period-cache; snapshot fallback only when nodes missing
 * @adr-ref: ADR-004, ADR-006, PERIOD_CACHE_ADR L2, L3
 *
 * @architecture:
 *   GET reads daily_ops_period_cache day nodes. Snapshot revenue section is logged fallback
 *   only when period nodes are missing for the range (not silent).
 *
 * @exports-to:
 * ✓ server/api/daily-ops/revenue/*
 */

import type { Db } from 'mongodb'
import { DAILY_OPS_SNAPSHOT_COLLECTIONS } from '~/types/daily-ops-snapshot'
import type { DailyOpsSnapshotRevenueSection } from '~/types/daily-ops-snapshot'
import type { DailyOpsRevenueQueryContext } from '~/types/daily-ops-revenue'
import { eachBusinessDate } from './dateRange'
import {
  expectedDayCount,
  loadPeriodDayNodesForRange,
} from '../dailyOpsPeriodCache/loadPeriodDayNodesForRange'
import {
  headlineExVatFromSnapshotSection,
  headlineIncVatFromSnapshotSection,
} from '../dailyOpsSnapshot/snapshotHeadlineRevenue'

export type RevenueRangeTotals = {
  revenue: number
  revenueIncVat: number
  borkRevenueIncVat: number
  borkRevenueExVat: number
  itemsCount: number
  foodRevenue: number
  beverageRevenue: number
  leadSource: 'inbox_basis' | 'bork_api' | 'datalab_benchmark' | 'unknown'
  dataGap: boolean
}

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

const EMPTY_TOTALS: RevenueRangeTotals = {
  revenue: 0,
  revenueIncVat: 0,
  borkRevenueIncVat: 0,
  borkRevenueExVat: 0,
  itemsCount: 0,
  foodRevenue: 0,
  beverageRevenue: 0,
  leadSource: 'unknown',
  dataGap: true,
}

function leadFromPeriod (source: string): RevenueRangeTotals['leadSource'] {
  if (source === 'inbox_digest') return 'inbox_basis'
  if (source === 'live_bork') return 'bork_api'
  return 'unknown'
}

async function fromPeriodCache (
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<RevenueRangeTotals | null> {
  const locationId = ctx.locationId ?? 'all'
  const nodes = await loadPeriodDayNodesForRange(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId,
  })
  const expected = expectedDayCount(ctx.startDate, ctx.endDate)
  if (nodes.length === 0) return null
  // Partial coverage still preferred over silent snapshot (caller may fall back if empty).
  if (nodes.length < expected && nodes.every((n) => n.revenue.exVat === 0)) return null

  let revenue = 0
  let revenueIncVat = 0
  let itemsCount = 0
  let food = 0
  let beverage = 0
  let inboxDays = 0
  let borkDays = 0
  for (const n of nodes) {
    revenue += n.revenue.exVat
    revenueIncVat += n.revenue.incVat
    food += n.revenue.food
    beverage += n.revenue.beverage
    itemsCount += (n.revenue.byCategory ?? []).reduce((s, c) => s + c.qty, 0)
    if (n.revenue.leadSource === 'inbox_digest') inboxDays++
    if (n.revenue.leadSource === 'live_bork') borkDays++
  }

  return {
    revenue: round2(revenue),
    revenueIncVat: round2(revenueIncVat),
    borkRevenueIncVat: round2(revenueIncVat),
    borkRevenueExVat: round2(revenue),
    itemsCount,
    foodRevenue: round2(food),
    beverageRevenue: round2(beverage),
    leadSource:
      inboxDays > 0
        ? 'inbox_basis'
        : borkDays > 0
          ? 'bork_api'
          : leadFromPeriod(nodes[0]?.revenue.leadSource ?? 'none'),
    dataGap: nodes.length === 0,
  }
}

async function fromSnapshotFallback (
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<RevenueRangeTotals> {
  console.warn(
    `[period-cache] revenue range miss ${ctx.startDate}..${ctx.endDate} loc=${ctx.locationId ?? 'all'} — snapshot fallback`,
  )
  const filter: Record<string, unknown> = {
    businessDate: { $gte: ctx.startDate, $lte: ctx.endDate },
  }
  if (ctx.locationId) filter.locationId = ctx.locationId

  const rows = await db.collection(DAILY_OPS_SNAPSHOT_COLLECTIONS.revenueSection).find(filter).toArray()
  if (rows.length === 0) return { ...EMPTY_TOTALS }

  let revenue = 0
  let revenueIncVat = 0
  let borkRevenueIncVat = 0
  let borkRevenueExVat = 0
  let itemsCount = 0
  let inboxDays = 0
  let datalabDays = 0
  for (const r of rows) {
    const doc = r as DailyOpsSnapshotRevenueSection
    revenue += headlineExVatFromSnapshotSection(doc)
    revenueIncVat += headlineIncVatFromSnapshotSection(doc)
    borkRevenueExVat += Number(doc.borkTotals?.ex_vat ?? 0)
    borkRevenueIncVat += Number(doc.borkTotals?.inc_vat ?? 0)
    itemsCount += Number(doc.totals?.quantity ?? doc.borkTotals?.quantity ?? 0)
    if (doc.leadSource === 'inbox') inboxDays++
    if (doc.leadSource === 'datalab_benchmark') datalabDays++
  }

  return {
    revenue: round2(revenue),
    revenueIncVat: round2(revenueIncVat),
    borkRevenueIncVat: round2(borkRevenueIncVat),
    borkRevenueExVat: round2(borkRevenueExVat),
    itemsCount,
    foodRevenue: 0,
    beverageRevenue: 0,
    leadSource:
      inboxDays > 0
        ? 'inbox_basis'
        : datalabDays > 0
          ? 'datalab_benchmark'
          : revenue > 0
            ? 'bork_api'
            : 'unknown',
    dataGap: false,
  }
}

/** Period-cache first; logged snapshot fallback when nodes missing. */
export async function fetchRevenueRange (
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<RevenueRangeTotals> {
  const fromCache = await fromPeriodCache(db, ctx)
  if (fromCache) return fromCache
  return fromSnapshotFallback(db, ctx)
}

export async function fetchRevenueRangeForDates (
  db: Db,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<RevenueRangeTotals> {
  return fetchRevenueRange(db, {
    period: 'custom',
    startDate,
    endDate,
    label: '',
    compareKind: 'none',
    locationId,
  })
}

export function listDatesInRange (startDate: string, endDate: string): string[] {
  return [...eachBusinessDate(startDate, endDate)]
}
