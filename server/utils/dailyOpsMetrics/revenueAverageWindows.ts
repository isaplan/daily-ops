/**
 * @registry-id: revenueAverageWindows
 * @created: 2026-07-25T11:20:00.000Z
 * @last-modified: 2026-07-25T11:20:00.000Z
 * @description: Pure date-window builders for revenue averages + YoY
 * @last-fix: [2026-07-25] Day→6 weekdays, week→6 weeks, month→3 months + YoY ranges
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsMetrics/fetchRevenueAverages.ts
 */

import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import type { RevenueAverageKind } from '~/types/revenue-averages'
import {
  getWeekEnd,
  getWeekStart,
  monthEndYmd,
} from '../dailyOpsSnapshot/aggregateDailyBundles'

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export function weekdayLabelForYmd (ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay()
  return WEEKDAY_LABELS[dow] ?? 'Day'
}

export function classifyAverageKind (period: string): RevenueAverageKind {
  if (period === 'this-week' || period === 'last-week') return 'weeks'
  if (
    period === 'this-month'
    || period === 'last-month'
    || period === 'this-year'
    || period === 'last-year'
  ) {
    return 'months'
  }
  return 'weekday'
}

/** Last N same weekdays before `ymd` (excludes current). */
export function sameWeekdayLookbackDates (ymd: string, count: number): string[] {
  const out: string[] = []
  let cursor = ymd
  for (let i = 0; i < count; i += 1) {
    cursor = addCalendarDaysYmd(cursor, -7)
    out.push(cursor)
  }
  return out
}

export type DateRange = { startDate: string; endDate: string }

/** Prior N full ISO weeks before the week containing `ymd` (newest first). */
export function priorWeekRanges (ymd: string, count: number): DateRange[] {
  const out: DateRange[] = []
  let weekStart = getWeekStart(ymd)
  for (let i = 0; i < count; i += 1) {
    weekStart = addCalendarDaysYmd(weekStart, -7)
    out.push({ startDate: weekStart, endDate: getWeekEnd(weekStart) })
  }
  return out
}

/** Prior N calendar months before the month of `ymd` (newest first). */
export function priorMonthRanges (ymd: string, count: number): DateRange[] {
  const out: DateRange[] = []
  let [y, m] = ymd.slice(0, 7).split('-').map(Number) as [number, number]
  for (let i = 0; i < count; i += 1) {
    m -= 1
    if (m < 1) {
      m = 12
      y -= 1
    }
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push({ startDate: `${key}-01`, endDate: monthEndYmd(key) })
  }
  return out
}

/** Same calendar day last year (clamped to last day of month if needed). */
export function sameDayLastYear (ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const year = (y ?? 2026) - 1
  const month = m ?? 1
  const day = d ?? 1
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const dd = Math.min(day, last)
  return `${year}-${String(month).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/** Same ISO week last year (Mon–Sun). */
export function sameWeekLastYear (ymd: string): DateRange {
  const start = getWeekStart(ymd)
  const lyStart = sameDayLastYear(start)
  // Align to Monday of that week
  const weekStart = getWeekStart(lyStart)
  return { startDate: weekStart, endDate: getWeekEnd(weekStart) }
}

/** Same calendar month last year. */
export function sameMonthLastYear (ymd: string): DateRange {
  const [y, m] = ymd.slice(0, 7).split('-').map(Number)
  const key = `${(y ?? 2026) - 1}-${String(m ?? 1).padStart(2, '0')}`
  return { startDate: `${key}-01`, endDate: monthEndYmd(key) }
}

export function averageLabel (kind: RevenueAverageKind, weekdayName: string): string {
  if (kind === 'weekday') return `Avg 6×${weekdayName.slice(0, 3)}`
  if (kind === 'weeks') return 'Avg 6w'
  return 'Avg 3m'
}

export function yearAgoLabel (kind: RevenueAverageKind): string {
  if (kind === 'weekday') return 'LY same day'
  if (kind === 'weeks') return 'LY same week'
  return 'LY same month'
}
