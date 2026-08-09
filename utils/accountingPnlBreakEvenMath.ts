/**
 * @registry-id: accountingPnlBreakEvenMath
 * @created: 2026-07-24T11:30:00.000Z
 * @last-modified: 2026-08-09T01:05:00.000Z
 * @description: Pure break-even math from accounting P&L rows (no I/O)
 * @last-fix: [2026-08-09] @adr-ref + PERIOD_CACHE_ADR L4 (formula only; GET path = period-cache)
 *   Prior: [2026-08-05] resolveFixedFlexTotalsForRows — per-row FT/flex then sum (no lonen avg dilution)
 * @adr-ref: ADR-013, ADR-014, ADR-019, ADR-020, ADR-022, PERIOD_CACHE_ADR L4
 *
 * @exports-to:
 * ✓ server/utils/accountingPnl/buildBreakEvenAssumptions.ts
 * ✓ server/utils/dailyOpsPeriodCache/resolveBreakEvenFromPeriodCache.ts
 */

import type { AccountingPnlRow } from '~/utils/accountingPnlData'
import {
  emptyLaborLonenLines,
  emptyRevenueBevLines,
  emptyRevenueFoodLines,
  emptyCogsBevLines,
  emptyCogsFoodLines,
  normalizeLaborLonenLines,
  sumLineMaps,
  type AccountingPnlLaborLonenLines,
} from '~/utils/accountingPnlGrandchildLines'
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

function num (v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** FT wages + overig lonen (fixed labor lines). */
export function fixedLonenFromLines (lines: AccountingPnlLaborLonenLines): number {
  return (
    num(lines.salarisBediening)
    + num(lines.salarisKeuken)
    + num(lines.salarisOverhead)
    + num(lines.overigLonen)
  )
}

/** PT (inhuur F&B) + ZZP (other inhuur) — flex labor lines. */
export function flexLonenFromLines (lines: AccountingPnlLaborLonenLines): number {
  return (
    num(lines.inhuurFb)
    + num(lines.inhuurAfwas)
    + num(lines.inhuurStewarding)
    + num(lines.inhuurKeuken)
    + num(lines.inhuurOverhead)
  )
}

/**
 * Fixed labor €: FT wages + overigLonen + sociale lasten + pensioen + laborOverig.
 * Legacy rows without lonen grandchildren → all labor treated as fixed.
 */
export function fixedLaborFromRow (row: AccountingPnlRow): number {
  const lines = normalizeLaborLonenLines(row.laborLonenLines)
  const fromLines = fixedLonenFromLines(lines)
  const flex = flexLonenFromLines(lines)
  const extras = num(row.laborSocialeLasten) + num(row.laborPensioen) + num(row.laborOverig)
  if (fromLines + flex <= 0 && num(row.labor) > 0) {
    return round2(num(row.labor))
  }
  return round2(fromLines + extras)
}

/** Flex labor €: PT + ZZP inhuur only. */
export function flexLaborFromRow (row: AccountingPnlRow): number {
  const lines = normalizeLaborLonenLines(row.laborLonenLines)
  const fromLines = fixedLonenFromLines(lines)
  const flex = flexLonenFromLines(lines)
  if (fromLines + flex <= 0 && num(row.labor) > 0) {
    return 0
  }
  return round2(flex)
}

/**
 * Monthly break-even (ADR-019):
 * BE = (fixedLabor + fixed) / (1 − cogs% − flexLaborRate)
 */
export function breakEvenFromTotals (
  revenue: number,
  cogs: number,
  fixedLabor: number,
  flexLabor: number,
  fixed: number,
): number | null {
  if (revenue <= 0) return null
  const cogsPct = cogs / revenue
  const flexLaborRate = flexLabor / revenue
  const cm = 1 - cogsPct - flexLaborRate
  if (cm < MIN_CM) return null
  return round2((fixedLabor + fixed) / cm)
}

export function breakEvenSliceFromRow (
  venueId: BreakEvenVenueKey,
  row: AccountingPnlRow,
  source: BreakEvenSource,
  opts?: { year?: number | null; month?: number | null; monthsInWindow?: number },
): BreakEvenVenueSlice | null {
  if (row.revenue <= 0) return null
  const fixedLabor = fixedLaborFromRow(row)
  const flexLabor = flexLaborFromRow(row)
  const be = breakEvenFromTotals(row.revenue, row.cogs, fixedLabor, flexLabor, row.fixed)
  if (be == null) return null
  const fixedLaborPct = round1((fixedLabor / row.revenue) * 100)
  const flexLaborPct = round1((flexLabor / row.revenue) * 100)
  return {
    venueId,
    monthlyBreakEven: be,
    monthlyRevenue: round2(row.revenue),
    monthlyLabor: round2(row.labor),
    monthlyFixedLabor: fixedLabor,
    monthlyFlexLabor: flexLabor,
    monthlyCogs: round2(row.cogs),
    monthlyFixed: round2(row.fixed),
    cogsPct: round1((row.cogs / row.revenue) * 100),
    laborPct: round1(((fixedLabor + flexLabor) / row.revenue) * 100),
    fixedLaborPct,
    flexLaborPct,
    source,
    year: opts?.year ?? null,
    month: opts?.month ?? null,
    monthsInWindow: opts?.monthsInWindow ?? 1,
  }
}

/**
 * Dollar-weighted FT/flex totals across sealed months (ADR-019 rule 2).
 * Resolves fixed/flex **per row** (legacy = all labor fixed) then sums euros —
 * never averages laborLonenLines across rows (that diluted flex/fixed when legacy months lack lonen lines).
 */
export type FixedFlexRowTotals = {
  revenue: number
  cogs: number
  fixedLabor: number
  flexLabor: number
  fixed: number
  labor: number
  n: number
}

export function resolveFixedFlexTotalsForRows (rows: AccountingPnlRow[]): FixedFlexRowTotals | null {
  if (!rows.length) return null
  let revenue = 0
  let cogs = 0
  let fixedLabor = 0
  let flexLabor = 0
  let fixed = 0
  let labor = 0
  for (const row of rows) {
    if (num(row.revenue) <= 0) continue
    revenue += num(row.revenue)
    cogs += num(row.cogs)
    fixedLabor += fixedLaborFromRow(row)
    flexLabor += flexLaborFromRow(row)
    fixed += num(row.fixed)
    labor += num(row.labor)
  }
  if (revenue <= 0) return null
  return {
    revenue: round2(revenue),
    cogs: round2(cogs),
    fixedLabor: round2(fixedLabor),
    flexLabor: round2(flexLabor),
    fixed: round2(fixed),
    labor: round2(labor),
    n: rows.filter((r) => num(r.revenue) > 0).length,
  }
}

/** Build rolling BreakEvenVenueSlice from dollar-weighted FT/flex totals (avg monthly €). */
export function breakEvenSliceFromFixedFlexTotals (
  venueId: BreakEvenVenueKey,
  totals: FixedFlexRowTotals,
  source: BreakEvenSource,
  opts?: { year?: number | null; month?: number | null },
): BreakEvenVenueSlice | null {
  if (totals.n <= 0 || totals.revenue <= 0) return null
  const avgRev = totals.revenue / totals.n
  const avgCogs = totals.cogs / totals.n
  const avgFixedLabor = totals.fixedLabor / totals.n
  const avgFlexLabor = totals.flexLabor / totals.n
  const avgFixed = totals.fixed / totals.n
  const avgLabor = totals.labor / totals.n
  const be = breakEvenFromTotals(avgRev, avgCogs, avgFixedLabor, avgFlexLabor, avgFixed)
  if (be == null) return null
  return {
    venueId,
    monthlyBreakEven: be,
    monthlyRevenue: round2(avgRev),
    monthlyLabor: round2(avgLabor),
    monthlyFixedLabor: round2(avgFixedLabor),
    monthlyFlexLabor: round2(avgFlexLabor),
    monthlyCogs: round2(avgCogs),
    monthlyFixed: round2(avgFixed),
    cogsPct: round1((totals.cogs / totals.revenue) * 100),
    laborPct: round1(((totals.fixedLabor + totals.flexLabor) / totals.revenue) * 100),
    fixedLaborPct: round1((totals.fixedLabor / totals.revenue) * 100),
    flexLaborPct: round1((totals.flexLabor / totals.revenue) * 100),
    source,
    year: opts?.year ?? null,
    month: opts?.month ?? null,
    monthsInWindow: totals.n,
  }
}

/** Average multiple sealed month rows into one synthetic row for rolling windows (dollar-weighted via sum÷n). */
export function sumPnlRowsForBreakEven (
  rows: AccountingPnlRow[],
): AccountingPnlRow | null {
  if (!rows.length) return null
  let revenue = 0
  let revenueFood = 0
  let revenueBeverage = 0
  let cogs = 0
  let cogsFood = 0
  let cogsBeverage = 0
  let labor = 0
  let laborLonen = 0
  let laborSocialeLasten = 0
  let laborPensioen = 0
  let laborOverig = 0
  let fixed = 0
  let fixedOverige = 0
  let fixedAfschrijving = 0
  let fixedFinancieel = 0
  let fixedOpbrengstVorderingen = 0
  let result = 0

  const lonenMaps = rows.map((r) => normalizeLaborLonenLines(r.laborLonenLines))
  const summedLonen = sumLineMaps(emptyLaborLonenLines, lonenMaps)

  for (const r of rows) {
    revenue += r.revenue
    revenueFood += r.revenueFood
    revenueBeverage += r.revenueBeverage
    cogs += r.cogs
    cogsFood += r.cogsFood
    cogsBeverage += r.cogsBeverage
    labor += r.labor
    laborLonen += r.laborLonen
    laborSocialeLasten += r.laborSocialeLasten
    laborPensioen += r.laborPensioen
    laborOverig += r.laborOverig
    fixed += r.fixed
    fixedOverige += r.fixedOverige > 0 ? r.fixedOverige : r.fixed
    fixedAfschrijving += r.fixedAfschrijving
    fixedFinancieel += r.fixedFinancieel
    fixedOpbrengstVorderingen += r.fixedOpbrengstVorderingen
    result += r.result
  }
  if (revenue <= 0) return null
  const n = rows.length
  const avgLonen = emptyLaborLonenLines()
  for (const key of Object.keys(summedLonen) as Array<keyof AccountingPnlLaborLonenLines>) {
    avgLonen[key] = summedLonen[key] / n
  }

  return {
    revenue: revenue / n,
    revenueFood: revenueFood / n,
    revenueBeverage: revenueBeverage / n,
    revenueFoodLines: emptyRevenueFoodLines(),
    revenueBevLines: emptyRevenueBevLines(),
    cogs: cogs / n,
    cogsFood: cogsFood / n,
    cogsBeverage: cogsBeverage / n,
    cogsFoodLines: emptyCogsFoodLines(),
    cogsBevLines: emptyCogsBevLines(),
    labor: labor / n,
    laborLonen: laborLonen / n,
    laborLonenLines: avgLonen,
    laborSocialeLasten: laborSocialeLasten / n,
    laborPensioen: laborPensioen / n,
    laborOverig: laborOverig / n,
    fixed: fixed / n,
    fixedOverige: fixedOverige / n,
    fixedAfschrijving: fixedAfschrijving / n,
    fixedFinancieel: fixedFinancieel / n,
    fixedOpbrengstVorderingen: fixedOpbrengstVorderingen / n,
    result: result / n,
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
