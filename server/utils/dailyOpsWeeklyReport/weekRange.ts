/**
 * @registry-id: dailyOpsWeeklyReportWeekRange
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-07-09T00:00:00.000Z
 * @description: ISO week range resolution for weekly digest
 * @last-fix: [2026-07-09] Initial week key helpers
 * @adr-ref: ADR-010, ADR-013
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsWeeklyReport/buildWeeklyDigest.ts
 * ✓ server/api/daily-ops/analytics/weekly-digest.get.ts
 */

import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import { getIsoWeek, getWeekStart } from '../dailyOpsSnapshot/aggregateDailyBundles'

export type WeeklyRange = {
  weekKey: string
  startDate: string
  endDate: string
  label: string
}

export function enumerateDaysInclusive(startDate: string, endDate: string): string[] {
  const out: string[] = []
  let cur = startDate
  while (cur <= endDate) {
    out.push(cur)
    cur = addCalendarDaysYmd(cur, 1)
  }
  return out
}

export function weekRangeFromKey(weekKey: string): WeeklyRange | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey.trim())
  if (!m) return null
  const year = Number(m[1])
  const week = Number(m[2])
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null

  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Dow = jan4.getUTCDay() || 7
  const mondayWeek1 = new Date(jan4)
  mondayWeek1.setUTCDate(jan4.getUTCDate() - jan4Dow + 1)
  const start = new Date(mondayWeek1)
  start.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7)
  const pad = (n: number) => String(n).padStart(2, '0')
  const startDate = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`
  const endDate = addCalendarDaysYmd(startDate, 6)
  return {
    weekKey: `${year}-W${pad(week)}`,
    startDate,
    endDate,
    label: `Week ${pad(week)} ${year}`,
  }
}

export function resolveWeeklyRange(input: {
  week?: string
  period?: string
  anchor?: string
}): WeeklyRange {
  if (input.week) {
    const fromKey = weekRangeFromKey(input.week)
    if (fromKey) return fromKey
  }
  const period = input.period === 'this-week' ? 'this-week' : 'last-week'
  const range = resolveDailyOpsPeriod(period, input.anchor)
  const weekKey = getIsoWeek(range.startDate)
  return {
    weekKey,
    startDate: range.startDate,
    endDate: range.endDate,
    label: period === 'this-week' ? `This week (${weekKey})` : `Last week (${weekKey})`,
  }
}

export function previousWeekRange(range: WeeklyRange): WeeklyRange {
  const startDate = addCalendarDaysYmd(range.startDate, -7)
  const endDate = addCalendarDaysYmd(range.endDate, -7)
  const weekKey = getIsoWeek(startDate)
  return { weekKey, startDate, endDate, label: `Previous week (${weekKey})` }
}

export function rollingWeekRanges(range: WeeklyRange, count: number): WeeklyRange[] {
  const out: WeeklyRange[] = []
  let cur = range
  for (let i = 0; i < count; i += 1) {
    cur = previousWeekRange(cur)
    out.push(cur)
  }
  return out
}

export function weekKeyForYmd(ymd: string): string {
  return getIsoWeek(getWeekStart(ymd))
}
