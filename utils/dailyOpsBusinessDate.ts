/**
 * @registry-id: dailyOpsBusinessDate
 * @created: 2026-03-01T00:00:00.000Z
 * @last-modified: 2026-06-07T00:00:00.000Z
 * @description: SSOT — Amsterdam register business_date (08:00 → 07:59 next calendar morning)
 * @last-fix: [2026-06-07] Add isOpenRegisterBusinessDate; document ADR-010 client rule
 * @adr-ref: ADR-010
 *
 * @architecture:
 *   - **Business day** = register opens 08:00 Europe/Amsterdam through 07:59:59 next calendar morning.
 *   - Label `business_date` YYYY-MM-DD = calendar date when register **opened** (not ISO midnight).
 *   - **Daily Ops UI + snapshot reads:** always `amsterdamOpenRegisterBusinessDateYmd()` / `registerBusinessDateForInstant()` — never raw ISO calendar for “today”.
 *   - **Integration fetch (Bork ticket/day.json):** may use `calendarYmdInAmsterdam` for API date param only.
 *
 * @exports-to:
 * ✓ utils/dailyOpsPeriod.ts => resolveDailyOpsPeriod
 * ✓ utils/dailyOpsRevenuePeriod.ts
 * ✓ server/utils/venueStrip/liveRevenue.ts => isOpenRegisterBusinessDate
 * ✓ server/utils/dailyOpsMetrics/context.ts
 * ✓ composables/useDailyOpsDashboardRoute.ts
 * ✓ components/daily-ops/DailyOpsDashboardShell.vue
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

/**
 * Map wall-clock (calendar YMD + hour 0–23 Amsterdam) → register `business_date`.
 * Hours 08–23 → same calendar date; 00–07 → previous calendar date (spillover tail).
 */
export function calendarHourToBusinessDate(calendarDateYmd: string, calendarHour: number): string {
  if (calendarHour >= 8 && calendarHour <= 23) return calendarDateYmd
  return addCalendarDaysYmd(calendarDateYmd, -1)
}

/** True when `ymd` is the currently open register business day (08:00 boundary). */
export function isOpenRegisterBusinessDate(ymd: string, now = new Date()): boolean {
  return ymd === amsterdamOpenRegisterBusinessDateYmd(now)
}
