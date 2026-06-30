/**
 * @registry-id: dailyOpsStaffParseAnalyticsQuery
 * @created: 2026-06-26T13:00:00.000Z
 * @last-modified: 2026-06-26T13:00:00.000Z
 * @description: Staff totals/plusmin — mode-based range (52wk / 12mo / years)
 * @last-fix: [2026-06-27] Monthly range from STAFF_YEAR_DATA_START
 *
 * @exports-to:
 * ✓ server/api/daily-ops/staff/timeseries.get.ts
 * ✓ server/api/daily-ops/staff/rolling-medians.get.ts
 */

import type { DailyOpsStaffQueryContext } from '~/types/daily-ops-staff'
import type { StaffChartGranularity } from '~/utils/dailyOpsStaffNav/modes'
import {
  coerceStaffNavMode,
  staffAnalyticsRange,
} from '~/utils/dailyOpsStaffNav/modes'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

export type StaffAnalyticsQueryContext = DailyOpsStaffQueryContext & {
  chartGranularity: StaffChartGranularity
}

export function parseStaffAnalyticsQuery(q: Record<string, unknown>): StaffAnalyticsQueryContext {
  const mode = coerceStaffNavMode(typeof q.mode === 'string' ? q.mode : 'monthly')
  const anchor =
    typeof q.anchor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.anchor)
      ? q.anchor
      : amsterdamOpenRegisterBusinessDateYmd()
  const range = staffAnalyticsRange(mode, anchor)

  const locRaw = typeof q.location === 'string' ? q.location : undefined
  const locationId = locRaw && locRaw !== 'all' ? locRaw : undefined

  return {
    period: `staff-${mode}`,
    startDate: range.startDate,
    endDate: range.endDate,
    label: range.label,
    locationId,
    chartGranularity: range.chartGranularity,
  }
}
