export function useDashboardEurFormat() {
  const formatter = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  })

  function formatEur(value: number): string {
    return formatter.format(value)
  }

  return { formatEur }
}
