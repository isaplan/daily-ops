/**
 * @registry-id: revenueNavV2ResolveRange
 * @created: 2026-06-08T00:00:00.000Z
 * @last-modified: 2026-06-08T00:00:00.000Z
 * @description: Pure function — V2 slot + optional pick date → { startDate, endDate, label, bucket }
 * @adr-ref: ADR-011, ADR-010
 *
 * @architecture:
 *   - Reuses resolveDailyOpsRevenuePeriod for V1-compatible slots.
 *   - Adds resolvers for w-2, w-3, m-YYYY-MM, spring/summer/autumn/winter[-1], menu-*, last-Nd/Xw/Xm.
 *   - "today" register day via amsterdamOpenRegisterBusinessDateYmd (ADR-010).
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenueNavV2.ts
 */

import type { RevenueNavV2Granularity, RevenueNavV2Range, RevenueNavV2Slot } from '~/types/daily-ops-revenue-nav-v2'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { resolveDailyOpsRevenuePeriod } from '~/utils/dailyOpsRevenuePeriod'
import type { DailyOpsRevenuePeriodId } from '~/types/daily-ops-revenue'

const AMSTERDAM_TZ = 'Europe/Amsterdam'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function utcYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function addWeeks(ymd: string, weeks: number): string {
  return addCalendarDaysYmd(ymd, weeks * 7)
}

function startOfIsoWeekUtc(d: Date): Date {
  const x = new Date(d)
  const dow = x.getUTCDay()
  const diff = dow === 0 ? -6 : 1 - dow
  x.setUTCDate(x.getUTCDate() + diff)
  return x
}

function seasonRange(year: number, season: 'spring' | 'summer' | 'autumn' | 'winter'): { start: string; end: string } {
  switch (season) {
    case 'spring':  return { start: `${year}-03-01`, end: `${year}-05-31` }
    case 'summer':  return { start: `${year}-06-01`, end: `${year}-08-31` }
    case 'autumn':  return { start: `${year}-09-01`, end: `${year}-11-30` }
    case 'winter':  return { start: `${year}-12-01`, end: `${year + 1}-02-28` }
  }
}

function currentSeasonYear(season: 'spring' | 'summer' | 'autumn' | 'winter', now: Date): number {
  const m = now.getUTCMonth() + 1
  // For winter that spans Dec-Feb, use the starting year
  if (season === 'winter') return m === 12 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  return now.getUTCFullYear()
}

function calendarYmdInAmsterdam(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: AMSTERDAM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')}`
}

/** Infer reasonable default bucket from date range length. */
export function inferBucket(startDate: string, endDate: string): RevenueNavV2Granularity {
  const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

/**
 * Resolve a V2 slot (+ optional day-picker override) to a date range.
 * Returns `null` for menu slots (those need async menu data — caller handles).
 */
export function resolveRevenueNavV2Range(
  slot: RevenueNavV2Slot,
  opts: {
    pick?: string | null
    granularity?: RevenueNavV2Granularity | null
    now?: Date
  } = {},
): RevenueNavV2Range | null {
  const now = opts.now ?? new Date()
  const openRegister = amsterdamOpenRegisterBusinessDateYmd(now)

  // Day-picker override for daily mode
  if (slot === 'today' && opts.pick) {
    const bucket: RevenueNavV2Granularity = 'day'
    return { startDate: opts.pick, endDate: opts.pick, label: opts.pick, bucket }
  }

  // --- V1-compatible daily slots ---
  const v1DailyMap: Partial<Record<string, DailyOpsRevenuePeriodId>> = {
    today: 'today', yesterday: 'yesterday',
    d2: 'd2', d3: 'd3', d4: 'd4', d5: 'd5', d6: 'd6', d7: 'd7',
    'this-week': 'this-week', 'last-week': 'last-week',
    'this-month': 'this-month', 'last-month': 'last-month',
    q1: 'q1', q2: 'q2', q3: 'q3', q4: 'q4', 'last-q': 'last-q',
    'this-year': 'this-year', 'last-year': 'last-year', 'year-2': 'year-2',
    'last-7d': 'last-7d', 'last-14d': 'last-14d',
  }
  const v1Id = v1DailyMap[slot]
  if (v1Id) {
    const r = resolveDailyOpsRevenuePeriod(v1Id, openRegister, now)
    const bucket = opts.granularity ?? inferBucket(r.startDate, r.endDate)
    return { startDate: r.startDate, endDate: r.endDate, label: r.label, bucket }
  }

  const year = now.getUTCFullYear()

  // --- w-2 / w-3 (rolling weeks) ---
  if (slot === 'w-2' || slot === 'w-3') {
    const weeksBack = slot === 'w-2' ? 2 : 3
    const thisWeekStart = startOfIsoWeekUtc(now)
    const start = new Date(thisWeekStart)
    start.setUTCDate(start.getUTCDate() - weeksBack * 7)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 6)
    const label = `${weeksBack}w ago`
    return { startDate: utcYmd(start), endDate: utcYmd(end), label, bucket: 'day' }
  }

  // --- m-YYYY-MM (calendar month) ---
  if (slot.startsWith('m-')) {
    const m = /^m-(\d{4})-(\d{2})$/.exec(slot)
    if (m) {
      const y = Number(m[1])
      const mo = Number(m[2])
      const start = new Date(Date.UTC(y, mo - 1, 1))
      const end = new Date(Date.UTC(y, mo, 0))
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const label = `${monthNames[mo - 1]} ${y}`
      return { startDate: utcYmd(start), endDate: utcYmd(end), label, bucket: opts.granularity ?? 'day' }
    }
  }

  // --- seasonal ---
  const seasonMap: Record<string, 'spring' | 'summer' | 'autumn' | 'winter'> = {
    spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter',
    'spring-1': 'spring', 'summer-1': 'summer', 'autumn-1': 'autumn', 'winter-1': 'winter',
  }
  const seasonKey = seasonMap[slot]
  if (seasonKey) {
    const priorYear = slot.endsWith('-1')
    const baseYear = currentSeasonYear(seasonKey, now) - (priorYear ? 1 : 0)
    const r = seasonRange(baseYear, seasonKey)
    const seasonLabels = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' }
    const label = `${seasonLabels[seasonKey]} ${baseYear}`
    const bucket = opts.granularity ?? 'week'
    return { startDate: r.start, endDate: r.end, label, bucket }
  }

  // --- period rolling slots ---
  const periodMap: Record<string, { days?: number; weeks?: number; months?: number; label: string }> = {
    'last-28d':  { days: 27,  label: 'Last 28 days' },
    'last-6w':   { weeks: 6,  label: 'Last 6 weeks' },
    'last-12w':  { weeks: 12, label: 'Last 12 weeks' },
    'last-24w':  { weeks: 24, label: 'Last 24 weeks' },
    'last-12m':  { months: 12, label: 'Last 12 months' },
  }
  const pm = periodMap[slot]
  if (pm) {
    const todayAms = calendarYmdInAmsterdam(now)
    let start: string
    if (pm.days != null) {
      start = addCalendarDaysYmd(todayAms, -pm.days)
    } else if (pm.weeks != null) {
      start = addWeeks(todayAms, -pm.weeks)
    } else {
      // months
      const d = new Date(now)
      d.setUTCMonth(d.getUTCMonth() - (pm.months ?? 12))
      start = utcYmd(d)
    }
    const defaultBuckets: Record<string, RevenueNavV2Granularity> = {
      'last-28d': 'day', 'last-6w': 'week', 'last-12w': 'week', 'last-24w': 'week', 'last-12m': 'month',
    }
    const bucket = opts.granularity ?? defaultBuckets[slot] ?? 'day'
    return { startDate: start, endDate: todayAms, label: pm.label, bucket }
  }

  // menu-* — no date range without menu data
  if (slot.startsWith('menu-')) return null

  return null
}

/** Weekday label (Sun Mon … Sat) for a rolling register-day slot. */
export function dailySlotWeekdayLabel(slot: RevenueNavV2Slot, now = new Date()): string {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const offsets: Record<string, number> = {
    today: 0, yesterday: 1, d2: 2, d3: 3, d4: 4, d5: 5, d6: 6, d7: 7,
  }
  const offset = offsets[slot]
  if (offset == null) return slot
  if (offset === 0) return 'Today'
  if (offset === 1) return 'Yesterday'
  const openReg = amsterdamOpenRegisterBusinessDateYmd(now)
  const d = new Date(openReg + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - offset)
  return DAYS[d.getUTCDay()] ?? slot
}
