export function formatAccountingPnlCompact (value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    const label = m >= 10 ? m.toFixed(0) : m.toFixed(2).replace(/\.?0+$/, '')
    return `${sign}€${label}M`
  }
  if (abs >= 1_000) return `${sign}€${Math.round(abs / 1_000)}k`
  return `${sign}€${Math.round(abs)}`
}

export function formatAccountingPnlPct (part: number, whole: number): string {
  if (whole <= 0) return '—'
  return `${Math.round((part / whole) * 100)}%`
}

export function formatAccountingPnlResult (value: number): string {
  const abs = formatAccountingPnlCompact(Math.abs(value))
  const pctPrefix = value >= 0 ? '+' : '−'
  return value >= 0 ? `+${abs.replace(/^−/, '')}` : `−${abs.replace(/^−/, '')}`
}
