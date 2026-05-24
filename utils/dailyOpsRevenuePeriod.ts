import {
  DAILY_OPS_REVENUE_PERIOD_IDS,
  type DailyOpsRevenueCompareKind,
  type DailyOpsRevenuePeriodId,
  type DailyOpsRevenueRange,
} from '~/types/daily-ops-revenue'
import {
  addCalendarDaysYmd,
  amsterdamOpenRegisterBusinessDateYmd,
} from '~/utils/dailyOpsBusinessDate'

const PERIOD_SET = new Set<string>(DAILY_OPS_REVENUE_PERIOD_IDS)

const REGISTER_DAY_OFFSET: Partial<Record<DailyOpsRevenuePeriodId, number>> = {
  today: 0,
  yesterday: 1,
  d2: 2,
  d3: 3,
  d4: 4,
  d5: 5,
  d6: 6,
  d7: 7,
}

const PERIOD_LABELS: Partial<Record<DailyOpsRevenuePeriodId, string>> = {
  today: 'Vandaag',
  yesterday: 'Gisteren',
  'this-week': 'Deze week',
  'last-week': 'Vorige week',
  wtd: 'Week tot nu toe',
  'last-7d': 'Laatste 7 dagen',
  'this-month': 'Deze maand',
  'last-month': 'Vorige maand',
  mtd: 'Maand tot nu toe',
  'last-30d': 'Laatste 30 dagen',
  q1: 'Q1',
  q2: 'Q2',
  q3: 'Q3',
  q4: 'Q4',
  'last-q': 'Vorig kwartaal',
  qtd: 'Kwartaal tot nu toe',
  lente: 'Lente',
  zomer: 'Zomer',
  herfst: 'Herfst',
  winter: 'Winter',
  'this-year': 'Dit jaar',
  'last-year': 'Vorig jaar',
  'year-2': '2 jaar geleden',
  ytd: 'Jaar tot nu toe',
  'last-365d': 'Laatste 365 dagen',
  'last-14d': 'Laatste 14 dagen',
  'last-60d': 'Laatste 60 dagen',
  'last-90d': 'Laatste 90 dagen',
  custom: 'Aangepast',
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

function daysBetweenInclusive(start: string, end: string): number {
  const s = parseYmd(start)
  const e = parseYmd(end)
  if (!s || !e) return 1
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
}

function quarterRange(year: number, q: 1 | 2 | 3 | 4): { start: string; end: string } {
  const starts = [`${year}-01-01`, `${year}-04-01`, `${year}-07-01`, `${year}-10-01`]
  const ends = [`${year}-03-31`, `${year}-06-30`, `${year}-09-30`, `${year}-12-31`]
  return { start: starts[q - 1]!, end: ends[q - 1]! }
}

function seasonRange(year: number, season: 'lente' | 'zomer' | 'herfst' | 'winter'): { start: string; end: string } {
  switch (season) {
    case 'lente':
      return { start: `${year}-03-01`, end: `${year}-05-31` }
    case 'zomer':
      return { start: `${year}-06-01`, end: `${year}-08-31` }
    case 'herfst':
      return { start: `${year}-09-01`, end: `${year}-11-30` }
    case 'winter':
      return { start: `${year}-12-01`, end: `${year + 1}-02-28` }
  }
}

function currentQuarter(d: Date): 1 | 2 | 3 | 4 {
  const m = d.getUTCMonth() + 1
  if (m <= 3) return 1
  if (m <= 6) return 2
  if (m <= 9) return 3
  return 4
}

function currentSeasonId(d: Date): 'lente' | 'zomer' | 'herfst' | 'winter' {
  const m = d.getUTCMonth() + 1
  if (m >= 3 && m <= 5) return 'lente'
  if (m >= 6 && m <= 8) return 'zomer'
  if (m >= 9 && m <= 11) return 'herfst'
  return 'winter'
}

export function resolveDailyOpsRevenuePeriod(
  raw: string | undefined,
  anchor?: string,
  now: Date = new Date(),
  custom?: { startDate?: string; endDate?: string },
): DailyOpsRevenueRange {
  const period = (PERIOD_SET.has(raw ?? '') ? raw : 'today') as DailyOpsRevenuePeriodId
  const label = PERIOD_LABELS[period] ?? period
  const openRegister = amsterdamOpenRegisterBusinessDateYmd(now)
  const refYmd = anchor && parseYmd(anchor) ? anchor : openRegister
  const refDate = parseYmd(refYmd)!

  const dayOffset = REGISTER_DAY_OFFSET[period]
  if (dayOffset != null) {
    const ymd = addCalendarDaysYmd(openRegister, -dayOffset)
    return { period, startDate: ymd, endDate: ymd, label }
  }

  if (period === 'custom' && custom?.startDate && custom?.endDate) {
    return { period, startDate: custom.startDate, endDate: custom.endDate, label: 'Aangepast' }
  }

  if (period === 'this-week') {
    const start = startOfIsoWeekUtc(refDate)
    const end = addDaysUtc(start, 6)
    return { period, startDate: utcYmd(start), endDate: utcYmd(end), label }
  }
  if (period === 'last-week') {
    const thisStart = startOfIsoWeekUtc(refDate)
    const start = addDaysUtc(thisStart, -7)
    const end = addDaysUtc(thisStart, -1)
    return { period, startDate: utcYmd(start), endDate: utcYmd(end), label }
  }
  if (period === 'wtd') {
    const start = startOfIsoWeekUtc(refDate)
    return { period, startDate: utcYmd(start), endDate: refYmd, label }
  }
  if (period === 'last-7d') {
    return { period, startDate: addCalendarDaysYmd(refYmd, -6), endDate: refYmd, label }
  }

  const year = refDate.getUTCFullYear()
  const month = refDate.getUTCMonth()

  if (period === 'this-month') {
    const start = new Date(Date.UTC(year, month, 1))
    const end = new Date(Date.UTC(year, month + 1, 0))
    return { period, startDate: utcYmd(start), endDate: utcYmd(end), label }
  }
  if (period === 'last-month') {
    const start = new Date(Date.UTC(year, month - 1, 1))
    const end = new Date(Date.UTC(year, month, 0))
    return { period, startDate: utcYmd(start), endDate: utcYmd(end), label }
  }
  if (period === 'mtd') {
    const start = new Date(Date.UTC(year, month, 1))
    return { period, startDate: utcYmd(start), endDate: refYmd, label }
  }
  if (period === 'last-30d') {
    return { period, startDate: addCalendarDaysYmd(refYmd, -29), endDate: refYmd, label }
  }

  if (period === 'q1' || period === 'q2' || period === 'q3' || period === 'q4') {
    const q = Number(period.slice(1)) as 1 | 2 | 3 | 4
    const r = quarterRange(year, q)
    return { period, startDate: r.start, endDate: r.end, label }
  }
  if (period === 'last-q') {
    const cq = currentQuarter(refDate)
    const y = cq === 1 ? year - 1 : year
    const q = cq === 1 ? 4 : ((cq - 1) as 1 | 2 | 3 | 4)
    const r = quarterRange(y, q)
    return { period, startDate: r.start, endDate: r.end, label }
  }
  if (period === 'qtd') {
    const cq = currentQuarter(refDate)
    const r = quarterRange(year, cq)
    return { period, startDate: r.start, endDate: refYmd, label }
  }

  if (period === 'lente' || period === 'zomer' || period === 'herfst' || period === 'winter') {
    const r = seasonRange(year, period)
    return { period, startDate: r.start, endDate: r.end, label }
  }

  if (period === 'this-year') {
    return { period, startDate: `${year}-01-01`, endDate: `${year}-12-31`, label }
  }
  if (period === 'last-year') {
    return { period, startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31`, label }
  }
  if (period === 'year-2') {
    return { period, startDate: `${year - 2}-01-01`, endDate: `${year - 2}-12-31`, label }
  }
  if (period === 'ytd') {
    return { period, startDate: `${year}-01-01`, endDate: refYmd, label }
  }
  if (period === 'last-365d') {
    return { period, startDate: addCalendarDaysYmd(refYmd, -364), endDate: refYmd, label }
  }

  const rollingDays: Partial<Record<DailyOpsRevenuePeriodId, number>> = {
    'last-14d': 13,
    'last-60d': 59,
    'last-90d': 89,
  }
  const roll = rollingDays[period]
  if (roll != null) {
    return { period, startDate: addCalendarDaysYmd(refYmd, -roll), endDate: refYmd, label }
  }

  const ymd = addCalendarDaysYmd(openRegister, 0)
  return { period: 'today', startDate: ymd, endDate: ymd, label: 'Vandaag' }
}

export function resolveRevenueCompareRange(
  kind: DailyOpsRevenueCompareKind,
  primary: DailyOpsRevenueRange,
  now: Date = new Date(),
  custom?: { startDate?: string; endDate?: string },
): DailyOpsRevenueRange | null {
  if (kind === 'none') return null
  if (kind === 'custom' && custom?.startDate && custom?.endDate) {
    return {
      period: 'custom',
      startDate: custom.startDate,
      endDate: custom.endDate,
      label: 'Vergelijking',
    }
  }
  const len = daysBetweenInclusive(primary.startDate, primary.endDate)
  if (kind === 'previous') {
    const end = addCalendarDaysYmd(primary.startDate, -1)
    const start = addCalendarDaysYmd(end, -(len - 1))
    return { period: 'custom', startDate: start, endDate: end, label: 'Vorige periode' }
  }
  if (kind === 'ly') {
    const shift = (ymd: string) => {
      const d = parseYmd(ymd)
      if (!d) return ymd
      d.setUTCFullYear(d.getUTCFullYear() - 1)
      return utcYmd(d)
    }
    return {
      period: 'custom',
      startDate: shift(primary.startDate),
      endDate: shift(primary.endDate),
      label: 'Vorig jaar',
    }
  }
  return null
}

export function periodLabelNl(period: DailyOpsRevenuePeriodId): string {
  return PERIOD_LABELS[period] ?? period
}
