/**
 * Amsterdam register / business_date helpers (Bork + Daily Ops).
 * Register opens 08:00 Europe/Amsterdam; before 08:00 the open day is the previous calendar date.
 */

export const AMSTERDAM_TZ = 'Europe/Amsterdam'

export function calendarYmdInAmsterdam(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: AMSTERDAM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')}`
}

export function hourInAmsterdam(d: Date): number {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: AMSTERDAM_TZ,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d)
  return parseInt(p.find((x) => x.type === 'hour')?.value ?? '0', 10)
}

export function addCalendarDaysYmd(ymd: string, delta: number): string {
  const parts = ymd.split('-').map((x) => Number(x))
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** `business_date` for the register day open at instant `d`. */
export function registerBusinessDateForInstant(d: Date): string {
  const cal = calendarYmdInAmsterdam(d)
  if (hourInAmsterdam(d) < 8) return addCalendarDaysYmd(cal, -1)
  return cal
}

/** Open register business_date right now (Daily Ops default anchor). */
export function amsterdamOpenRegisterBusinessDateYmd(now = new Date()): string {
  return registerBusinessDateForInstant(now)
}
