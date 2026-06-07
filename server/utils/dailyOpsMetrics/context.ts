/**
 * @registry-id: dailyOpsMetricsContext
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-06-07T00:00:00.000Z
 * @description: Daily Ops dashboard query context (period, dates, location filter)
 * @last-fix: [2026-06-07] startDate/endDate are register business_date (ADR-010), not ISO calendar
 * @adr-ref: ADR-004, ADR-010
 *
 * @architecture:
 *   - `startDate` / `endDate` = inclusive `business_date` from resolveDailyOpsPeriod (08:00 Amsterdam boundary).
 *   - Never derive these from `calendarYmdInAmsterdam()` or UTC `toISOString().slice(0, 10)`.
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsDashboardMetrics.ts (barrel)
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import type { DailyOpsPeriodId } from '~/types/daily-ops-dashboard'

export type DailyOpsMetricsContext = {
  period: DailyOpsPeriodId
  startDate: string
  endDate: string
  locationId: string | undefined
  eitjeLocationId?: string | number | undefined
}

export function parseDailyOpsMetricsQuery(q: Record<string, unknown>): DailyOpsMetricsContext {
  const periodRaw = typeof q.period === 'string' ? q.period : 'today'
  const anchor = typeof q.anchor === 'string' ? q.anchor : undefined
  const range = resolveDailyOpsPeriod(periodRaw, anchor)
  const locRaw = typeof q.location === 'string' ? q.location : undefined
  let locationId: string | undefined
  if (locRaw && locRaw !== 'all') {
    locationId = locRaw
  }
  return {
    period: range.period,
    startDate: range.startDate,
    endDate: range.endDate,
    locationId,
  }
}

export function enumerateUtcDatesInclusive(start: string, end: string): string[] {
  const out: string[] = []
  const [ys, ms, ds] = start.split('-').map(Number)
  const [ye, me, de] = end.split('-').map(Number)
  let cur = new Date(Date.UTC(ys ?? 0, (ms ?? 1) - 1, ds ?? 1)).getTime()
  const endT = new Date(Date.UTC(ye ?? 0, (me ?? 1) - 1, de ?? 1)).getTime()
  while (cur <= endT) {
    const dt = new Date(cur)
    const p = (n: number) => String(n).padStart(2, '0')
    out.push(`${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`)
    cur += 86400000
  }
  return out
}
