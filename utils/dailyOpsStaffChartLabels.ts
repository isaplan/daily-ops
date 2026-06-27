import type { StaffChartGranularity } from '~/utils/dailyOpsStaffNav/modes'

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const

export function formatStaffChartBucketLabel(
  bucketKey: string,
  granularity: StaffChartGranularity,
): string {
  if (granularity === 'year') return bucketKey.slice(0, 4)

  if (granularity === 'month') {
    const [y, m] = bucketKey.split('-')
    const mi = Number(m) - 1
    const mon = MONTHS[mi] ?? m
    return `${y} - ${mon}`
  }

  const [y, m, d] = bucketKey.split('-')
  const mi = Number(m) - 1
  const mon = MONTHS[mi] ?? m
  return `${y} - ${mon} - ${Number(d)}`
}
