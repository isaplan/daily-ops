/**
 * @registry-id: dailyOpsInsightsResolveRange
 * @created: 2026-06-30T20:00:00.000Z
 * @last-modified: 2026-06-30T20:00:00.000Z
 * @description: Resolve insights slot → current + prior month/year ranges
 * @last-fix: [2026-06-30] Prior = previous calendar month or year
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsInsights/buildPerformanceInsights.ts
 */

import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import { STAFF_YEAR_DATA_START } from '~/utils/dailyOpsStaffNav/modes'
import type { InsightsNavMode } from '~/utils/dailyOpsInsightsNav/modes'

export type InsightsResolvedRange = {
  key: string
  startDate: string
  endDate: string
  label: string
}

export type InsightsRangePair = {
  mode: InsightsNavMode
  current: InsightsResolvedRange
  prior: InsightsResolvedRange | null
  trendStartDate: string
  trendEndDate: string
  trendLabel: string
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`
}

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  let y = year
  let m = month + delta
  while (m < 1) {
    m += 12
    y -= 1
  }
  while (m > 12) {
    m -= 12
    y += 1
  }
  return { year: y, month: m }
}

function monthRange(year: number, month: number, capEndYmd?: string): InsightsResolvedRange {
  const startDate = `${year}-${pad(month)}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  let endDate = `${year}-${pad(month)}-${pad(lastDay)}`
  if (capEndYmd && endDate > capEndYmd) endDate = capEndYmd
  return {
    key: monthKey(year, month),
    startDate,
    endDate,
    label: monthLabel(year, month),
  }
}

function yearRange(year: number, capEndYmd?: string): InsightsResolvedRange {
  let endDate = `${year}-12-31`
  if (capEndYmd && endDate > capEndYmd) endDate = capEndYmd
  return {
    key: String(year),
    startDate: `${year}-01-01`,
    endDate,
    label: String(year),
  }
}

function resolveMonthSlot(slot: string, anchor: string): InsightsResolvedRange {
  if (slot === 'this-month' || slot === 'last-month') {
    const r = resolveDailyOpsPeriod(slot, anchor)
    const y = Number(r.startDate.slice(0, 4))
    const m = Number(r.startDate.slice(5, 7))
    return monthRange(y, m, r.endDate)
  }
  const m = /^m-(\d{4})-(\d{2})$/.exec(slot)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2])
    return monthRange(y, mo)
  }
  const fallback = resolveDailyOpsPeriod('last-month', anchor)
  const y = Number(fallback.startDate.slice(0, 4))
  const mo = Number(fallback.startDate.slice(5, 7))
  return monthRange(y, mo, fallback.endDate)
}

function resolveYearSlot(slot: string, anchor: string): InsightsResolvedRange {
  if (slot === 'this-year' || slot === 'last-year') {
    const r = resolveDailyOpsPeriod(slot, anchor)
    const y = Number(r.startDate.slice(0, 4))
    return yearRange(y, r.endDate)
  }
  const y = /^y-(\d{4})$/.exec(slot)
  if (y) return yearRange(Number(y[1]))
  const fallback = resolveDailyOpsPeriod('last-year', anchor)
  const yr = Number(fallback.startDate.slice(0, 4))
  return yearRange(yr, fallback.endDate)
}

export function resolveInsightsRangePair(
  mode: InsightsNavMode,
  slot: string,
  anchor: string,
): InsightsRangePair {
  if (mode === 'monthly') {
    const current = resolveMonthSlot(slot, anchor)
    const y = Number(current.startDate.slice(0, 4))
    const m = Number(current.startDate.slice(5, 7))
    const prev = shiftMonth(y, m, -1)
    const prior = monthRange(prev.year, prev.month)
    const trendEnd = current.endDate
    const trendStartMonth = shiftMonth(y, m, -11)
    let trendStartDate = `${trendStartMonth.year}-${pad(trendStartMonth.month)}-01`
    if (trendStartDate < STAFF_YEAR_DATA_START) trendStartDate = STAFF_YEAR_DATA_START
    return {
      mode,
      current,
      prior,
      trendStartDate,
      trendEndDate: trendEnd,
      trendLabel: 'Last 12 months',
    }
  }

  const current = resolveYearSlot(slot, anchor)
  const y = Number(current.key)
  const prior = y > 2020 ? yearRange(y - 1) : null
  return {
    mode,
    current,
    prior,
    trendStartDate: STAFF_YEAR_DATA_START,
    trendEndDate: current.endDate,
    trendLabel: 'All years',
  }
}
