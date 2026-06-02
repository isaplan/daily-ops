/** Whole-euro display SSOT for Daily Ops dashboard (nl-NL: € 1.000, no cents). */

const eurWholeFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function roundDashboardEur(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}

export function formatDashboardEur(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return eurWholeFormatter.format(roundDashboardEur(value))
}
