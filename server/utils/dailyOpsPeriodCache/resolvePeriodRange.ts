/**
 * @registry-id: dailyOpsPeriodCacheResolvePeriodRange
 * @created: 2026-08-08T21:20:00.000Z
 * @last-modified: 2026-08-08T21:20:00.000Z
 * @description: Canonical any-range resolver over daily_ops_period_cache only
 * @last-fix: [2026-08-09] @adr-ref → PERIOD_CACHE_ADR L2; used by BE cutover
 * @adr-ref: PERIOD_CACHE_ADR L2
 * @data-source: period-cache
 * @read-cache-json: daily_ops_period_cache · day|week|month|year
 *
 * @exports-to:
 * ✓ scripts/validate-period-cache.ts
 * ✓ (Phase 2) Daily Ops GET cutovers
 */

import type { Db } from 'mongodb'
import type { DailyOpsPeriodNode } from '~/types/daily-ops-period-cache'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import {
  getIsoWeek,
  getMonthKey,
  getWeekEnd,
  getWeekStart,
  getYearKey,
  monthEndYmd,
} from '../dailyOpsSnapshot/aggregateDailyBundles'
import { findPeriodNode } from './store'

export type ResolvedPeriodCover = {
  nodes: DailyOpsPeriodNode[]
  missingDayKeys: string[]
  levelsUsed: Array<DailyOpsPeriodNode['level']>
}

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Greedy cover: full years → yearly; full months → monthly; full ISO weeks → weekly;
 * remaining days → daily. Reads period-cache only.
 */
export async function resolvePeriodRange (
  db: Db,
  opts: {
    startDate: string
    endDate: string
    locationId: string
  },
): Promise<ResolvedPeriodCover> {
  const { startDate, endDate, locationId } = opts
  const nodes: DailyOpsPeriodNode[] = []
  const missingDayKeys: string[] = []
  const levelsUsed = new Set<DailyOpsPeriodNode['level']>()

  let cursor = startDate
  while (cursor <= endDate) {
    const yearKey = getYearKey(cursor)
    const yearStart = `${yearKey}-01-01`
    const yearEnd = `${yearKey}-12-31`
    if (cursor === yearStart && yearEnd <= endDate) {
      const yearly = await findPeriodNode(db, {
        locationId,
        level: 'year',
        periodKey: yearKey,
      })
      if (yearly && yearly.status !== 'partial') {
        nodes.push(yearly)
        levelsUsed.add('year')
        cursor = addCalendarDaysYmd(yearEnd, 1)
        continue
      }
    }

    const monthKey = getMonthKey(cursor)
    const monthStart = `${monthKey}-01`
    const monthEnd = monthEndYmd(monthKey)
    if (cursor === monthStart && monthEnd <= endDate) {
      const monthly = await findPeriodNode(db, {
        locationId,
        level: 'month',
        periodKey: monthKey,
      })
      if (monthly) {
        nodes.push(monthly)
        levelsUsed.add('month')
        cursor = addCalendarDaysYmd(monthEnd, 1)
        continue
      }
    }

    const weekStart = getWeekStart(cursor)
    const weekEnd = getWeekEnd(cursor)
    if (cursor === weekStart && weekEnd <= endDate) {
      const weekKey = getIsoWeek(cursor)
      const weekly = await findPeriodNode(db, {
        locationId,
        level: 'week',
        periodKey: weekKey,
      })
      if (weekly) {
        nodes.push(weekly)
        levelsUsed.add('week')
        cursor = addCalendarDaysYmd(weekEnd, 1)
        continue
      }
    }

    const daily = await findPeriodNode(db, {
      locationId,
      level: 'day',
      periodKey: cursor,
    })
    if (daily) {
      nodes.push(daily)
      levelsUsed.add('day')
    } else {
      missingDayKeys.push(cursor)
    }
    cursor = addCalendarDaysYmd(cursor, 1)
  }

  return {
    nodes,
    missingDayKeys,
    levelsUsed: [...levelsUsed],
  }
}

/** Sum revenue/labor totals from a resolved cover (Phase 1 helper). */
export function sumResolvedNodes (nodes: DailyOpsPeriodNode[]): {
  exVat: number
  food: number
  beverage: number
  loadedCost: number
  hours: number
  cogsAmount: number
  breakEven: number
  netProfit: number
} {
  let exVat = 0
  let food = 0
  let beverage = 0
  let loadedCost = 0
  let hours = 0
  let cogsAmount = 0
  let breakEven = 0
  let netProfit = 0
  for (const n of nodes) {
    exVat += n.revenue.exVat
    food += n.revenue.food
    beverage += n.revenue.beverage
    loadedCost += n.labor.loadedCost
    hours += n.labor.hours
    cogsAmount += n.cogs.amount
    breakEven += n.ratios.breakEven
    netProfit += n.ratios.netProfit
  }
  return {
    exVat: round2(exVat),
    food: round2(food),
    beverage: round2(beverage),
    loadedCost: round2(loadedCost),
    hours: round2(hours),
    cogsAmount: round2(cogsAmount),
    breakEven: round2(breakEven),
    netProfit: round2(netProfit),
  }
}
