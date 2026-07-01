/**
 * @registry-id: dailyOpsOrderTimeHeadline
 * @created: 2026-07-01T12:00:00.000Z
 * @last-modified: 2026-07-01T12:00:00.000Z
 * @description: Sum order-time Bork hour rows into daily headline totals (open register day).
 * @last-fix: [2026-07-01] SSOT for today headline = order-entry time, not paid/close time
 * @adr-ref: ADR-004, ADR-010
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/buildRevenueSection.ts
 * ✓ server/utils/dailyOpsSnapshot/snapshotHeadlineRevenue.ts
 */

import type { DailyOpsSnapshotRevenueSection, RevenueBreakdown } from '~/types/daily-ops-snapshot'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

type HourDoc = {
  total_revenue_ex_vat?: number
  total_revenue_inc_vat?: number
  total_revenue?: number
  total_vat?: number
  total_quantity?: number
  record_count?: number
}

export function sumBorkOrderHourDocs(docs: HourDoc[]): RevenueBreakdown & {
  quantity: number
  record_count: number
} {
  let ex_vat = 0
  let inc_vat = 0
  let vat = 0
  let quantity = 0
  let record_count = 0
  for (const h of docs) {
    ex_vat += Number(h.total_revenue_ex_vat ?? 0)
    inc_vat += Number(h.total_revenue_inc_vat ?? h.total_revenue ?? 0)
    vat += Number(h.total_vat ?? 0)
    quantity += Number(h.total_quantity ?? 0)
    record_count += Number(h.record_count ?? 0)
  }
  return {
    ex_vat: round2(ex_vat),
    inc_vat: round2(inc_vat),
    vat: round2(vat),
    quantity: round2(quantity),
    record_count,
  }
}

export function sumOrderHourlySlots(
  slots: DailyOpsSnapshotRevenueSection['orderHourly'] | undefined,
): RevenueBreakdown {
  if (!slots?.length) return { ex_vat: 0, inc_vat: 0, vat: 0 }
  let ex_vat = 0
  let inc_vat = 0
  let vat = 0
  for (const slot of slots) {
    ex_vat += Number(slot.revenue?.ex_vat ?? 0)
    inc_vat += Number(slot.revenue?.inc_vat ?? 0)
    vat += Number(slot.revenue?.vat ?? 0)
  }
  return { ex_vat: round2(ex_vat), inc_vat: round2(inc_vat), vat: round2(vat) }
}
