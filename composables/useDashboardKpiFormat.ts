import { formatDashboardEur, roundDashboardEur } from '~/utils/dashboardEurFormat'

export function useDashboardKpiFormat () {
  function formatEurWhole (value: number): string {
    return formatDashboardEur(value)
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
    return `${formatDashboardEur(value)}/h`
  }

  return { formatEurWhole, formatHoursWhole, formatPctWhole, formatEurPerHourWhole }
}
