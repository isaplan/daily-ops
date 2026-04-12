import type { DailyOpsLaborDayDto } from '~/types/daily-ops-dashboard'

export type DayHoursShareParts = { hours: string; pct: string | null }

function formatPct (pct: number): string {
  const r = Math.round(pct * 10) / 10
  if (Math.abs(r - Math.round(r)) < 1e-6) return `${Math.round(r)}%`
  return `${r.toFixed(1)}%`
}

/** Hours label (e.g. `76.3h`) and optional share of calendar day total, for stacked display. */
export function getDayHoursShareParts (amountHours: number, day: DailyOpsLaborDayDto): DayHoursShareParts {
  if (day.hours <= 0) {
    if (amountHours === 0) return { hours: '—', pct: null }
    return { hours: `${amountHours.toFixed(1)}h`, pct: null }
  }
  const pct = (amountHours / day.hours) * 100
  return { hours: `${amountHours.toFixed(1)}h`, pct: formatPct(pct) }
}

/** Plain text for single-line cells (e.g. productivity table). */
export function formatDayHoursSharePlain (amountHours: number, day: DailyOpsLaborDayDto): string {
  const p = getDayHoursShareParts(amountHours, day)
  if (!p.pct) return p.hours
  return `${p.hours} ${p.pct}`
}
