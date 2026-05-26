/**
 * @registry-id: dailyOpsHeadlineRevenue
 * @created: 2026-05-25T21:35:00.000Z
 * @last-modified: 2026-05-26T00:38:00.000Z
 * @description: Shared Daily Ops headline revenue rule for venue strip and P&L interval cards.
 * @last-fix: [2026-05-26] Today uses snapshot-selected register-day revenue, not a Bork-only calendar-day rule.
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsVenueStrip.ts
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { DailyOpsMetricsContext } from './dailyOpsDashboardMetrics'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function resolveDailyOpsHeadlineRevenue(
  ctx: DailyOpsMetricsContext,
  input: {
    snapshotExVat?: number | null
    apiDayTotal?: number | null
    inboxExVat: number | null
    categoryTotal?: number
  },
): number {
  const snapshotTotal = round2(input.snapshotExVat ?? 0)
  if (snapshotTotal > 0) return snapshotTotal

  const singleClosedBusinessDay = ctx.startDate === ctx.endDate && ctx.period !== 'today'
  const inboxTotal = round2(input.inboxExVat ?? 0)
  if (singleClosedBusinessDay && inboxTotal > 0) return inboxTotal

  const apiTotal = round2(input.apiDayTotal ?? 0)
  if (apiTotal > 0) return apiTotal

  return round2(input.categoryTotal ?? 0)
}
