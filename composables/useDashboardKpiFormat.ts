export function useDashboardKpiFormat () {
  const eurWholeFormatter = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  function formatEurWhole (value: number): string {
    return eurWholeFormatter.format(Math.round(value))
  }

  function formatHoursWhole (value: number): string {
    return `${Math.round(value)} h`
  }

  function formatPctWhole (value: number | null): string {
    if (value == null || !Number.isFinite(value)) return '—'
    return `${Math.round(value)}%`
  }

  function formatEurPerHourWhole (value: number | null): string {
    if (value == null || !Number.isFinite(value)) return '—'
    return `${formatEurWhole(value)}/h`
  }

  return { formatEurWhole, formatHoursWhole, formatPctWhole, formatEurPerHourWhole }
}
