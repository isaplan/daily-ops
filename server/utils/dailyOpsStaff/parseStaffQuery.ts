/**
 * @registry-id: dailyOpsStaffParseQuery
 * @created: 2026-06-25T12:00:00.000Z
 * @last-modified: 2026-06-25T12:00:00.000Z
 * @description: Parses staff analytics API query params
 * @last-fix: [2026-06-25] Reuse revenue period resolver for staff totals
 *
 * @exports-to:
 * ✓ server/api/daily-ops/staff/timeseries.get.ts
 * ✓ server/api/daily-ops/staff/rolling-medians.get.ts
 */

import { parseRevenueQuery } from '../dailyOpsRevenue/parseRevenueQuery'
import type { DailyOpsStaffQueryContext } from '~/types/daily-ops-staff'

export function parseStaffQuery(q: Record<string, unknown>): DailyOpsStaffQueryContext {
  const ctx = parseRevenueQuery(q)
  return {
    period: ctx.period,
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    label: ctx.label,
    locationId: ctx.locationId,
  }
}
