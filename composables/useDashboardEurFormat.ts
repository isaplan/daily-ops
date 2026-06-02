import { formatDashboardEur } from '~/utils/dashboardEurFormat'

export function useDashboardEurFormat() {
  function formatEur(value: number): string {
    return formatDashboardEur(value)
  }

  return { formatEur }
}
