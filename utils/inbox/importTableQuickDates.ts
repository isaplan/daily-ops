/**
 * Amsterdam calendar labels for inbox import table quick picks (reportDate).
 * Offsets use 24h steps from "now" then format in Europe/Amsterdam — edge cases near DST are rare for ops use.
 */

const AMS = 'Europe/Amsterdam'

function ymdSvSe(d: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: AMS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** Today (Amsterdam) as YYYY-MM-DD */
export function amsterdamTodayYmd(anchor = new Date()): string {
  return ymdSvSe(anchor)
}

/** Amsterdam calendar YYYY-MM-DD roughly `offsetDays` away from anchor (24h × offset). */
export function amsterdamYmdForOffset(offsetDays: number, anchor = new Date()): string {
  const d = new Date(anchor.getTime() + offsetDays * 24 * 60 * 60 * 1000)
  return ymdSvSe(d)
}

export function weekdayShortForYmd(ymd: string, locale = 'nl-NL'): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  if (!y || !m || !d) return ''
  return new Intl.DateTimeFormat(locale, {
    timeZone: AMS,
    weekday: 'short',
  }).format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)))
}
