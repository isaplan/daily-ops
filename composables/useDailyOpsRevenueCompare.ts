export type RevenueDelta = { amount: number; pct: number | null }

export function revenueDelta(current: number, compare: number | null | undefined): RevenueDelta | null {
  if (compare == null || !Number.isFinite(compare)) return null
  const amount = Math.round((current - compare) * 100) / 100
  const pct =
    compare > 0 ? Math.round(((current - compare) / compare) * 10000) / 100 : null
  return { amount, pct }
}

export function useDailyOpsRevenueCompare() {
  const { formatEur } = useDashboardEurFormat()

  function formatDelta(delta: RevenueDelta | null | undefined): string {
    if (!delta) return '—'
    const sign = delta.amount >= 0 ? '+' : ''
    const pct =
      delta.pct != null ? ` (${delta.pct >= 0 ? '+' : ''}${delta.pct}%)` : ''
    return `${sign}${formatEur(delta.amount)}${pct}`
  }

  function deltaClass(delta: RevenueDelta | null | undefined): string {
    if (delta?.pct == null) return 'text-gray-600'
    return delta.pct < 0 ? 'text-red-600' : 'text-green-700'
  }

  return { revenueDelta, formatDelta, deltaClass }
}
