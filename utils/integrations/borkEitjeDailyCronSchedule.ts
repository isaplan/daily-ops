/**
 * @registry-id: borkEitjeDailyCronSchedule
 * @created: 2026-06-07T00:00:00.000Z
 * @last-modified: 2026-06-07T12:00:00.000Z
 * @description: SSOT — Bork + Eitje daily-data Nitro cron hours per Amsterdam weekday
 * @last-fix: [2026-06-07] Self-contained (no imports) — safe for nuxt.config jiti bootstrap
 *
 * @architecture:
 *   - All times Europe/Amsterdam (server TZ=Europe/Amsterdam on DO).
 *   - Cron DOW: 0=Sun … 6=Sat (standard cron).
 *   - Task: integrations:bork-eitje-daily (Bork then Eitje daily-data).
 *
 * @exports-to:
 * ✓ nuxt.config.ts
 * ✓ composables/useDailyOpsDashboardMetrics.ts
 * ✓ pages/daily-ops/settings/bork-api.vue
 * ✓ pages/daily-ops/settings/eitje-api.vue
 */

/** Local copy — do not import dailyOpsBusinessDate here (nuxt.config loads this before ~ alias). */
const AMSTERDAM_TZ = 'Europe/Amsterdam'

function hourInAmsterdam(d: Date): number {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: AMSTERDAM_TZ,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d)
  return parseInt(p.find((x) => x.type === 'hour')?.value ?? '0', 10)
}

/** User-facing label hour → cron hour (24:00 = 00:00). */
export function normalizeScheduleHour(hour: number): number {
  return hour === 24 ? 0 : hour
}

/** Amsterdam weekday 0=Sun … 6=Sat. */
export function amsterdamWeekday(d: Date): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: AMSTERDAM_TZ, weekday: 'short' }).format(d)
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[wd] ?? 0
}

/**
 * Wall-clock hours per cron weekday (Amsterdam).
 * Source: ops spec 2026-06-07 — more frequent pulls on busy nights.
 */
export const BORK_EITJE_DAILY_CRON_HOURS_BY_DOW: Readonly<Record<number, readonly number[]>> = {
  /** Monday */
  1: [8, 16, 17, 18, 19, 20, 21, 22, 23, 1],
  /** Tuesday – Thursday */
  2: [8, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 1],
  3: [8, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 1],
  4: [8, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 1],
  /** Friday */
  5: [8, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 1, 2],
  /** Saturday */
  6: [8, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 1, 2],
  /** Sunday */
  0: [8, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 1],
}

const DOW_LABEL: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

export function cronHoursForWeekday(dow: number): number[] {
  const raw = BORK_EITJE_DAILY_CRON_HOURS_BY_DOW[dow] ?? []
  return [...new Set(raw.map(normalizeScheduleHour))].sort((a, b) => a - b)
}

export function cronHoursForDate(d = new Date()): number[] {
  return cronHoursForWeekday(amsterdamWeekday(d))
}

/** Human-readable schedule lines for settings UI. */
export function formatBorkEitjeDailyCronScheduleLines(): string[] {
  return [1, 2, 3, 4, 5, 6, 0].map((dow) => {
    const hours = (BORK_EITJE_DAILY_CRON_HOURS_BY_DOW[dow] ?? [])
      .map((h) => String(h).padStart(2, '0') + ':00')
      .join(', ')
    return `${DOW_LABEL[dow]}: ${hours}`
  })
}

/** Nitro scheduledTasks entries for integrations:bork-eitje-daily (one cron expr per DOW). */
export function buildBorkEitjeDailyNitroCronEntries(): Record<string, ['integrations:bork-eitje-daily']> {
  const out: Record<string, ['integrations:bork-eitje-daily']> = {}
  for (const dow of [0, 1, 2, 3, 4, 5, 6]) {
    const hours = cronHoursForWeekday(dow)
    if (hours.length === 0) continue
    out[`0 ${hours.join(',')} * * ${dow}`] = ['integrations:bork-eitje-daily']
  }
  return out
}

/** Next cron hour after `hour` on the same Amsterdam weekday (wraps to next day first slot). */
export function nextDailyCronHourAfter(hour: number, d = new Date()): number {
  const hours = cronHoursForDate(d)
  const next = hours.find((h) => h > hour)
  return next ?? hours[0]! + 24
}

export function isDailyCronHour(hour: number, d = new Date()): boolean {
  return cronHoursForDate(d).includes(hour)
}

/** For dashboard cache keys — use Amsterdam wall clock. */
export function dailyCronCacheWindowKey(d = new Date()): string {
  const hour = hourInAmsterdam(d)
  const hours = cronHoursForDate(d)
  if (hours.includes(hour)) return `${hour}`
  return `until-${nextDailyCronHourAfter(hour, d)}`
}
