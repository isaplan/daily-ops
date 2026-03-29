import type { DailyOpsPeriodId } from '~/types/daily-ops-dashboard'

const DAILY_OPS_PERIODS: readonly DailyOpsPeriodId[] = [
  'today',
  'yesterday',
  'this-week',
  'last-week',
]

export type DailyOpsDateRange = {
  period: DailyOpsPeriodId
  startDate: string
  endDate: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** YYYY-MM-DD in UTC (matches toISOString().slice(0, 10) for a UTC calendar day). */
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
 * Resolves a dashboard period to inclusive UTC date range (YYYY-MM-DD).
 * Anchor defaults to current UTC date; optional `anchor` query can align client and server.
 */
export function resolveDailyOpsPeriod(
  raw: string | undefined,
  anchor?: string
): DailyOpsDateRange {
  const period = (DAILY_OPS_PERIODS.includes(raw as DailyOpsPeriodId) ? raw : 'today') as DailyOpsPeriodId

  const anchorDate =
    anchor && parseYmd(anchor) ? parseYmd(anchor)! : new Date()

  const today = utcYmd(anchorDate)

  if (period === 'today') {
    return { period, startDate: today, endDate: today }
  }

  if (period === 'yesterday') {
    const y = addDaysUtc(parseYmd(today)!, -1)
    const ymd = utcYmd(y)
    return { period, startDate: ymd, endDate: ymd }
  }

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
