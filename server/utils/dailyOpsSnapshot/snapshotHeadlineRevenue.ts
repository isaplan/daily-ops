/**
 * @registry-id: dailyOpsSnapshotHeadlineRevenue
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-07-01T12:00:00.000Z
 * @description: Read headline revenue from sealed snapshot sections (ADR-004/006). No inbox or Bork on GET.
 * @last-fix: [2026-07-01] Open register day reads order-time hourly sum, not paid-time totals
 *   Prior: [2026-05-28] Snapshot totals are SSOT on dashboard/revenue GET paths
 * @adr-ref: ADR-004, ADR-006, ADR-010
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsRevenue/fetchRevenueRange.ts
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 * ✓ server/utils/dailyOpsVenueStrip.ts
 */

import type { DailyOpsSnapshotRevenueSection, LeadRevenueSource, RevenueBreakdown } from '~/types/daily-ops-snapshot'
import { isOpenRegisterBusinessDate } from '~/utils/dailyOpsBusinessDate'
import { sumOrderHourlySlots } from '../dailyOpsRevenue/orderTimeHeadline'

function headlineFromSection(rev: DailyOpsSnapshotRevenueSection): RevenueBreakdown {
  if (isOpenRegisterBusinessDate(rev.businessDate)) {
    const fromTotals: RevenueBreakdown = {
      ex_vat: Number(rev.totals?.ex_vat ?? 0),
      inc_vat: Number(rev.totals?.inc_vat ?? 0),
      vat: Number(rev.totals?.vat ?? 0),
    }
    if (fromTotals.ex_vat > 0 || fromTotals.inc_vat > 0) return fromTotals
    return sumOrderHourlySlots(rev.orderHourly)
  }
  return {
    ex_vat: Number(rev.totals?.ex_vat ?? 0),
    inc_vat: Number(rev.totals?.inc_vat ?? 0),
    vat: Number(rev.totals?.vat ?? 0),
  }
}

export function headlineExVatFromSnapshotSection(rev: DailyOpsSnapshotRevenueSection | null | undefined): number {
  if (!rev) return 0
  return headlineFromSection(rev).ex_vat
}

export function headlineIncVatFromSnapshotSection(rev: DailyOpsSnapshotRevenueSection | null | undefined): number {
  if (!rev) return 0
  return headlineFromSection(rev).inc_vat
}

export function leadSourceFromSnapshotSection(rev: DailyOpsSnapshotRevenueSection | null | undefined): LeadRevenueSource | 'unknown' {
  if (!rev) return 'unknown'
  return rev.leadSource ?? 'unknown'
}
