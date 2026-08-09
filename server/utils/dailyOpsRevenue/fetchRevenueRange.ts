/**
 * @registry-id: dailyOpsRevenueFetchRange
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-08-09T15:50:00.000Z
 * @description: Revenue + items for a date range — period-cache day nodes (GET)
 * @last-fix: [2026-08-09] ZERO GET — period-cache only; miss → zeros + dataGap (no snapshot)
 * @adr-ref: ADR-004, ADR-006, PERIOD_CACHE_ADR L2, L3
 *
 * @architecture:
 *   GET reads daily_ops_period_cache day nodes only. Missing nodes → zeros + dataGap.
 *
 * @exports-to:
 * ✓ server/api/daily-ops/revenue/*
 */

import type { Db } from 'mongodb'
import type { DailyOpsRevenueQueryContext } from '~/types/daily-ops-revenue'
import { eachBusinessDate } from './dateRange'
import { loadPeriodDayNodesForRange } from '../dailyOpsPeriodCache/loadPeriodDayNodesForRange'

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

/** Period-cache only. Miss / empty → zeros + dataGap. */
export async function fetchRevenueRange (
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<RevenueRangeTotals> {
  const locationId = ctx.locationId ?? 'all'
  const nodes = await loadPeriodDayNodesForRange(db, {
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    locationId,
  })
  if (nodes.length === 0) return { ...EMPTY_TOTALS }

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
    dataGap: false,
  }
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
