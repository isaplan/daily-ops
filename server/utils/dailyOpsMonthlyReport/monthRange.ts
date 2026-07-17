/**
 * @registry-id: dailyOpsMonthlyReportMonthRange
 * @created: 2026-07-17T00:00:00.000Z
 * @last-modified: 2026-07-17T01:10:00.000Z
 * @description: Calendar-month range resolution for monthly digest
 * @last-fix: [2026-07-17] Open-period helper (current + previous month)
 * @adr-ref: ADR-010, ADR-013, ADR-015
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsMonthlyReport/buildMonthlyDigest.ts
 * ✓ server/utils/monthlyReportDocument/*
 * ✓ server/api/monthly-reports/*
 */

import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

export type MonthlyRange = {
  monthKey: string
  startDate: string
  endDate: string
  label: string
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function monthRangeFromKey(monthKey: string): MonthlyRange | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null
  const startDate = `${year}-${pad2(month)}-01`
  const endDate = `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`
  return {
    monthKey: `${year}-${pad2(month)}`,
    startDate,
    endDate,
    label: `${MONTH_LABELS[month - 1]} ${year}`,
  }
}

export function resolveMonthlyRange(input: {
  month?: string
  period?: string
  anchor?: string
}): MonthlyRange {
  if (input.month) {
    const fromKey = monthRangeFromKey(input.month)
    if (fromKey) return fromKey
  }
  const anchor = input.anchor ?? amsterdamOpenRegisterBusinessDateYmd()
  const [yStr, mStr] = anchor.split('-')
  const year = Number(yStr)
  const month = Number(mStr)
  const period = input.period === 'this-month' ? 'this-month' : 'last-month'
  if (period === 'this-month') {
    const key = `${year}-${pad2(month)}`
    const range = monthRangeFromKey(key)
    if (range) return { ...range, label: `This month (${key})` }
  }
  const prev = previousMonthRange({
    monthKey: `${year}-${pad2(month)}`,
    startDate: `${year}-${pad2(month)}-01`,
    endDate: `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`,
    label: '',
  })
  return { ...prev, label: `Last month (${prev.monthKey})` }
}

export function previousMonthRange(range: MonthlyRange): MonthlyRange {
  const [yStr, mStr] = range.monthKey.split('-')
  let year = Number(yStr)
  let month = Number(mStr) - 1
  if (month < 1) {
    month = 12
    year -= 1
  }
  const key = `${year}-${pad2(month)}`
  const next = monthRangeFromKey(key)
  if (!next) {
    return {
      monthKey: key,
      startDate: `${year}-${pad2(month)}-01`,
      endDate: `${year}-${pad2(month)}-01`,
      label: `Previous month (${key})`,
    }
  }
  return { ...next, label: `Previous month (${key})` }
}

export function rollingMonthRanges(range: MonthlyRange, count: number): MonthlyRange[] {
  const out: MonthlyRange[] = []
  let cur = range
  for (let i = 0; i < count; i += 1) {
    cur = previousMonthRange(cur)
    out.push(cur)
  }
  return out
}

export function monthKeyForYmd(ymd: string): string {
  const [y, m] = ymd.split('-')
  return `${y}-${m}`
}

/** Current + previous calendar month stay open (not auto-locked). */
export function isMonthlyReportOpenPeriod(monthKey: string, anchorYmd?: string): boolean {
  const anchor = anchorYmd ?? amsterdamOpenRegisterBusinessDateYmd()
  const current = monthKeyForYmd(anchor)
  if (monthKey === current) return true
  const curRange = monthRangeFromKey(current)
  if (!curRange) return false
  return monthKey === previousMonthRange(curRange).monthKey
}
