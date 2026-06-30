/**
 * @registry-id: dailyOpsStaffNavModes
 * @created: 2026-06-25T16:00:00.000Z
 * @last-modified: 2026-06-27T23:55:00.000Z
 * @description: Staff analytics nav — weekly / monthly / yearly ranges + chart buckets
 * @last-fix: [2026-06-27] Monthly range from STAFF_YEAR_DATA_START (not trailing 12mo)
 *
 * @exports-to:
 * ✓ components/daily-ops/staff/nav/StaffAnalyticsNav.vue
 * ✓ composables/useDailyOpsStaffMetrics.ts
 * ✓ server/utils/dailyOpsStaff/parseStaffAnalyticsQuery.ts
 */

import type { RevenueNavV2Slot } from '~/types/daily-ops-revenue-nav-v2'

export const STAFF_NAV_MODES = ['weekly', 'monthly', 'yearly'] as const
export type StaffNavMode = (typeof STAFF_NAV_MODES)[number]

export type StaffChartGranularity = 'week' | 'month' | 'year'

export const STAFF_YEAR_DATA_START = '2024-01-01'

export const STAFF_NAV_MODE_CONFIGS: Array<{ id: StaffNavMode; label: string; defaultSlot: RevenueNavV2Slot }> = [
  { id: 'weekly', label: 'Weekly', defaultSlot: 'this-week' },
  { id: 'monthly', label: 'Monthly', defaultSlot: 'this-month' },
  { id: 'yearly', label: 'Yearly', defaultSlot: 'this-year' },
]

const STAFF_MODE_SET = new Set<string>(STAFF_NAV_MODES)

export function isStaffNavMode(mode: string): mode is StaffNavMode {
  return STAFF_MODE_SET.has(mode)
}

export function defaultStaffNavQuery(anchor: string): Record<string, string> {
  return { mode: 'monthly', slot: 'this-month', anchor }
}

export function coerceStaffNavMode(mode: string): StaffNavMode {
  return isStaffNavMode(mode) ? mode : 'monthly'
}

/** Display range + chart bucket per staff mode. */
export function staffAnalyticsRange(
  mode: StaffNavMode,
  endDate: string,
): {
  startDate: string
  endDate: string
  label: string
  chartGranularity: StaffChartGranularity
} {
  switch (mode) {
    case 'weekly': {
      const end = new Date(`${endDate}T12:00:00Z`)
      const day = end.getUTCDay()
      const mondayOffset = day === 0 ? -6 : 1 - day
      end.setUTCDate(end.getUTCDate() + mondayOffset)
      const start = new Date(end)
      start.setUTCDate(start.getUTCDate() - 7 * 51)
      return {
        startDate: start.toISOString().slice(0, 10),
        endDate,
        label: 'Last 52 weeks',
        chartGranularity: 'week',
      }
    }
    case 'monthly':
      return {
        startDate: STAFF_YEAR_DATA_START,
        endDate,
        label: 'All months since 2024',
        chartGranularity: 'month',
      }
    case 'yearly':
      return {
        startDate: STAFF_YEAR_DATA_START,
        endDate,
        label: 'All years',
        chartGranularity: 'year',
      }
  }
}

export function chartGranularityForStaffMode(mode: StaffNavMode): StaffChartGranularity {
  return staffAnalyticsRange(mode, '2026-01-01').chartGranularity
}

export function chartGranularityLabel(mode: StaffNavMode): string {
  switch (mode) {
    case 'weekly':
      return 'per week'
    case 'monthly':
      return 'per month'
    case 'yearly':
      return 'per year'
  }
}
