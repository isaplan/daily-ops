/**
 * @registry-id: dailyOpsHeadlineRevenue
 * @created: 2026-05-25T21:35:00.000Z
 * @last-modified: 2026-05-27T20:30:00.000Z
 * @description: Delegates to basis-report-mapper SSOT — never trusts stale snapshot totals.ex_vat.
 * @last-fix: [2026-05-27] Read path uses borkTotals + morning inbox only (resolveVenueDayHeadlineRevenue).
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsVenueStrip.ts
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 */

import type { DailyOpsMetricsContext } from './dailyOpsMetrics/context'
import {
  headlineExVatFromSnapshotRevenue,
  type BasisReportData,
} from './inbox/basis-report-mapper'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** @deprecated Prefer headlineExVatFromSnapshotRevenue + morning inbox map. */
export function resolveDailyOpsHeadlineRevenue(
  _ctx: DailyOpsMetricsContext,
  input: {
    snapshotExVat?: number | null
    apiDayTotal?: number | null
    inboxExVat: number | null
    categoryTotal?: number
    morningInbox?: BasisReportData[]
  },
): number {
  const morning = input.morningInbox ?? []
  if (morning.length > 0 || (input.apiDayTotal ?? 0) > 0) {
    return round2(
      headlineExVatFromSnapshotRevenue(
        {
          borkTotals: {
            ex_vat: Number(input.apiDayTotal ?? 0),
            inc_vat: 0,
            vat: 0,
            quantity: 0,
            record_count: input.apiDayTotal != null && input.apiDayTotal > 0 ? 1 : 0,
          },
        },
        morning,
      ),
    )
  }
  if ((input.categoryTotal ?? 0) > 0) return round2(input.categoryTotal ?? 0)
  return round2(input.snapshotExVat ?? 0)
}
