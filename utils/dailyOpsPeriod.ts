/**
 * @registry-id: dailyOpsPeriodResolver
 * @created: 2026-05-19T00:00:00.000Z
 * @last-modified: 2026-06-07T00:00:00.000Z
 * @description: Resolves Daily Ops dashboard periods to register business_date ranges
 * @last-fix: [2026-06-07] Document ADR-010 — today/yesterday use open register day, not ISO calendar
 * @adr-ref: ADR-010
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsPeriod.ts (re-export)
 * ✓ server/utils/dailyOpsMetrics/context.ts
 * ✓ composables/useDailyOpsDashboardRoute.ts
 */

import type { DailyOpsPeriodId } from '~/types/daily-ops-dashboard'
import {
  addCalendarDaysYmd,
  amsterdamOpenRegisterBusinessDateYmd,
} from '~/utils/dailyOpsBusinessDate'

const DAILY_OPS_PERIODS: readonly DailyOpsPeriodId[] = [
  'today',
  'yesterday',
  'd2',
  'd3',
  'd4',
  'd5',
  'd6',
  'd7',
  'this-week',
  'last-week',
]

/** Days before the open register day (today = 0). */
const REGISTER_DAY_OFFSET: Partial<Record<DailyOpsPeriodId, number>> = {
  today: 0,
  yesterday: 1,
  d2: 2,
  d3: 3,
  d4: 4,
  d5: 5,
  d6: 6,
  d7: 7,
}

export type DailyOpsDateRange = {
  period: DailyOpsPeriodId
  startDate: string
  endDate: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function utcYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const day = Number(m[3])
  const d = new Date(Date.UTC(y, mo, day))
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo || d.getUTCDate() !== day) return null
  return d
}

function startOfIsoWeekUtc(anchor: Date): Date {
  const d = new Date(anchor)
  const dow = d.getUTCDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

function addDaysUtc(d: Date, days: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + days)
  return x
}

/**
 * Resolves a dashboard period to inclusive business_date range (YYYY-MM-DD).
 * Single-day tabs use the open Amsterdam register day at `now` (08:00 boundary), not UTC calendar.
 */
export function resolveDailyOpsPeriod(
  raw: string | undefined,
  anchor?: string,
  now: Date = new Date(),
): DailyOpsDateRange {
  const period = (DAILY_OPS_PERIODS.includes(raw as DailyOpsPeriodId) ? raw : 'today') as DailyOpsPeriodId

  const openRegister = amsterdamOpenRegisterBusinessDateYmd(now)
  const dayOffset = REGISTER_DAY_OFFSET[period]
  if (dayOffset != null) {
    const ymd = addCalendarDaysYmd(openRegister, -dayOffset)
    return { period, startDate: ymd, endDate: ymd }
  }

  const refYmd = anchor && parseYmd(anchor) ? anchor : openRegister
  const anchorDate = parseYmd(refYmd)!

  if (period === 'this-week') {
    const start = startOfIsoWeekUtc(anchorDate)
    const end = addDaysUtc(start, 6)
    return { period, startDate: utcYmd(start), endDate: utcYmd(end) }
  }

  const thisStart = startOfIsoWeekUtc(anchorDate)
  const lastStart = addDaysUtc(thisStart, -7)
  const lastEnd = addDaysUtc(thisStart, -1)
  return { period, startDate: utcYmd(lastStart), endDate: utcYmd(lastEnd) }
}
