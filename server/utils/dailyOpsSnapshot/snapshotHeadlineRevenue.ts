/**
 * @registry-id: dailyOpsSnapshotHeadlineRevenue
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Read headline revenue from sealed snapshot sections (ADR-004/006). No inbox or Bork on GET.
 * @last-fix: [2026-05-28] Snapshot totals are SSOT on dashboard/revenue GET paths
 * @adr-ref: ADR-004, ADR-006
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsRevenue/fetchRevenueRange.ts
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 * ✓ server/utils/dailyOpsVenueStrip.ts
 */

import type { DailyOpsSnapshotRevenueSection, LeadRevenueSource } from '~/types/daily-ops-snapshot'

export function headlineExVatFromSnapshotSection(rev: DailyOpsSnapshotRevenueSection | null | undefined): number {
  if (!rev) return 0
  return Number(rev.totals?.ex_vat ?? 0)
}

export function headlineIncVatFromSnapshotSection(rev: DailyOpsSnapshotRevenueSection | null | undefined): number {
  if (!rev) return 0
  return Number(rev.totals?.inc_vat ?? 0)
}

export function leadSourceFromSnapshotSection(rev: DailyOpsSnapshotRevenueSection | null | undefined): LeadRevenueSource | 'unknown' {
  if (!rev) return 'unknown'
  return rev.leadSource ?? 'unknown'
}
