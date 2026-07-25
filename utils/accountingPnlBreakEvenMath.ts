/**
 * @registry-id: accountingPnlBreakEvenMath
 * @created: 2026-07-24T11:30:00.000Z
 * @last-modified: 2026-07-24T11:30:00.000Z
 * @description: Pure break-even math from accounting P&L rows (no I/O)
 * @last-fix: [2026-07-24] BE = (labor+fixed)/(1-cogs%); rolling avg + day/week project
 * @adr-ref: ADR-014
 *
 * @exports-to:
 * ✓ server/utils/accountingPnl/buildBreakEvenAssumptions.ts
 * ✓ server/utils/dailyOpsMetrics/resolveBreakEven.ts
 */

import type { AccountingPnlRow } from '~/utils/accountingPnlData'
import type {
  BreakEvenSource,
  BreakEvenVenueKey,
  BreakEvenVenueSlice,
} from '~/types/break-even'

const MIN_CM = 0.05

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function round1 (n: number): number {
  return Math.round(n * 10) / 10
}

/** Monthly break-even: labor+fixed treated as period costs; COGS variable. */
export function breakEvenFromTotals (
  revenue: number,
  cogs: number,
  labor: number,
  fixed: number,
): number | null {
  if (revenue <= 0) return null
  const cogsPct = cogs / revenue
  const cm = 1 - cogsPct
  if (cm < MIN_CM) return null
  return round2((labor + fixed) / cm)
}

export function breakEvenSliceFromRow (
  venueId: BreakEvenVenueKey,
  row: AccountingPnlRow,
  source: BreakEvenSource,
  opts?: { year?: number | null; month?: number | null; monthsInWindow?: number },
): BreakEvenVenueSlice | null {
  const be = breakEvenFromTotals(row.revenue, row.cogs, row.labor, row.fixed)
  if (be == null || row.revenue <= 0) return null
  return {
    venueId,
    monthlyBreakEven: be,
    monthlyRevenue: round2(row.revenue),
    monthlyLabor: round2(row.labor),
    monthlyCogs: round2(row.cogs),
    monthlyFixed: round2(row.fixed),
    cogsPct: round1((row.cogs / row.revenue) * 100),
    laborPct: round1((row.labor / row.revenue) * 100),
    source,
    year: opts?.year ?? null,
    month: opts?.month ?? null,
    monthsInWindow: opts?.monthsInWindow ?? 1,
  }
}

/** Average multiple sealed month rows into one synthetic row for rolling windows. */
export function sumPnlRowsForBreakEven (
  rows: AccountingPnlRow[],
): AccountingPnlRow | null {
  if (!rows.length) return null
  let revenue = 0
  let cogs = 0
  let labor = 0
  let fixed = 0
  let fixedOverige = 0
  for (const r of rows) {
    revenue += r.revenue
    cogs += r.cogs
    labor += r.labor
    fixed += r.fixed
    fixedOverige += r.fixedOverige > 0 ? r.fixedOverige : r.fixed
  }
  if (revenue <= 0) return null
  const n = rows.length
  return {
    ...rows[0]!,
    revenue: revenue / n,
    cogs: cogs / n,
    labor: labor / n,
    fixed: fixed / n,
    fixedOverige: fixedOverige / n,
  }
}

export function projectBreakEvenForDays (
  monthlyBreakEven: number,
  daysInMonth: number,
  dayCount: number,
): number {
  if (daysInMonth <= 0 || dayCount <= 0 || monthlyBreakEven <= 0) return 0
  return round2((monthlyBreakEven / daysInMonth) * dayCount)
}

export function pctVsBreakEven (revenue: number, breakEven: number): number | null {
  if (breakEven <= 0) return null
  return round1(((revenue - breakEven) / breakEven) * 100)
}

export function daysInCalendarMonth (year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function monthKey (year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}
