/**
 * @registry-id: revenueNavV2MonthOptions
 * @created: 2026-06-08T00:00:00.000Z
 * @last-modified: 2026-06-24T00:00:00.000Z
 * @description: Generate last 12 month slot options (this-month, last-month, then m-YYYY-MM pills)
 * @last-fix: [2026-06-24] Fix month pill sequence — start at 2 months ago, not 3
 * @adr-ref: ADR-011
 *
 * @exports-to:
 * ✓ utils/dailyOpsRevenueNavV2/modes.ts
 * ✓ components/daily-ops/revenue/nav-v2/child/RevenueChildMonthly.vue
 */

import type { RevenueNavV2SlotOption } from '~/types/daily-ops-revenue-nav-v2'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Build m-YYYY-MM slot id from year + 1-based month. */
export function monthSlotId(year: number, month: number): `m-${string}` {
  return `m-${year}-${pad(month)}`
}

export type MonthOption = RevenueNavV2SlotOption & {
  year: number
  month: number
}

/**
 * Returns last `count` calendar months as slot options, most recent first.
 * Excludes this-month and last-month (those are fixed pills).
 */
export function buildMonthSlotOptions(now = new Date(), count = 10): MonthOption[] {
  const options: MonthOption[] = []
  let year = now.getUTCFullYear()
  let month = now.getUTCMonth() + 1

  // this-month + last-month are fixed pills — start rolling list 2 months ago
  for (let skip = 0; skip < 2; skip++) {
    month -= 1
    if (month < 1) {
      month = 12
      year -= 1
    }
  }

  for (let i = 0; i < count; i++) {
    const label = `${MONTH_LABELS[month - 1]} ${year}`
    const short = MONTH_LABELS[month - 1]!
    options.push({
      id: monthSlotId(year, month),
      label,
      short,
      year,
      month,
    })
    month -= 1
    if (month < 1) {
      month = 12
      year -= 1
    }
  }
  return options
}

/** All 12-month pill options including this-month + last-month at the front. */
export function buildMonthPillOptions(now = new Date()): RevenueNavV2SlotOption[] {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1

  const thisLabel = `${MONTH_LABELS[month - 1]} ${year}`
  let prevYear = year
  let prevMonth = month - 1
  if (prevMonth < 1) { prevMonth = 12; prevYear -= 1 }
  const prevLabel = `${MONTH_LABELS[prevMonth - 1]} ${prevYear}`

  return [
    { id: 'this-month', label: 'This month', short: thisLabel },
    { id: 'last-month', label: 'Last month', short: prevLabel },
    ...buildMonthSlotOptions(now, 12),
  ]
}
