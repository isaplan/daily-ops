/**
 * @registry-id: buildPnlBudget
 * @created: 2026-08-12T00:15:00.000Z
 * @last-modified: 2026-08-12T00:40:00.000Z
 * @description: 10% margin budget/forecast — cost envelope, COGS@25%, fixed vs flex, weekly ÷4
 * @last-fix: [2026-08-12] Phase 1: cost=rev−10%, COGS target 25%, flex leftover, week slice
 * @adr-ref: ADR-019, ADR-022
 *
 * @exports-to:
 * ✓ server/api/daily-ops/finance/analytics/budget.get.ts
 */

import type { Db } from 'mongodb'
import type { AccountingPnlAnalyticsVenue } from '~/types/accounting-pnl-analytics'
import type {
  PnlBudgetBaselineRates,
  PnlBudgetCostEnvelope,
  PnlBudgetDto,
  PnlBudgetMonth,
  PnlBudgetRevenueMode,
  PnlBudgetSeasonPhase,
  PnlBudgetSeasonStory,
  PnlBudgetWeekSlice,
} from '~/types/accounting-pnl-budget'
import {
  PNL_BUDGET_TARGET_COGS_PCT,
  PNL_BUDGET_TARGET_MARGIN,
  PNL_BUDGET_WEEKS_PER_MONTH,
} from '~/types/accounting-pnl-budget'
import type { AccountingPnlRow, AccountingPnlVenueId } from '~/utils/accountingPnlData'
import { ACCOUNTING_PNL_MONTH_LABELS } from '~/utils/accountingPnlData'
import {
  breakEvenFromTotals,
  fixedLaborFromRow,
  flexLaborFromRow,
} from '~/utils/accountingPnlBreakEvenMath'
import { fetchSealedMonthlyPnlRows } from '~/server/utils/accountingPnl/fetchSealedMonthlyPnlRows'

const MIN_CM = 0.05
/** Dec-style OH credit: fixedOverige deeply negative → exclude from rate baseline. */
const OH_STAMP_OVERIGE_LT = -50_000

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function round1 (n: number): number {
  return Math.round(n * 10) / 10
}

function monthKey (year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthLabel (year: number, month: number): string {
  const name = ACCOUNTING_PNL_MONTH_LABELS[month - 1] ?? String(month)
  return `${name} ${year}`
}

function rowForVenue (doc: { venues: Record<AccountingPnlVenueId, AccountingPnlRow>; combined: AccountingPnlRow }, venue: AccountingPnlAnalyticsVenue): AccountingPnlRow {
  return venue === 'combined' ? doc.combined : doc.venues[venue]
}

function isOhStampMonth (row: AccountingPnlRow): boolean {
  return Number(row.fixedOverige ?? 0) < OH_STAMP_OVERIGE_LT || Number(row.fixed) < 0
}

function addMonth (year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}

/** Ops calendar: Jan–Mar weak, spring up, summer stable/soft, autumn slow, Dec strong. */
function seasonForMonth (month: number): { phase: PnlBudgetSeasonPhase; label: string } {
  if (month >= 1 && month <= 3) return { phase: 'winter_weak', label: 'Winter weak' }
  if (month >= 4 && month <= 5) return { phase: 'spring_up', label: 'Spring up' }
  if (month >= 6 && month <= 8) return { phase: 'summer_stable', label: 'Summer stable' }
  if (month >= 9 && month <= 11) return { phase: 'autumn_slow', label: 'Autumn slow' }
  return { phase: 'december_strong', label: 'December strong' }
}

const SEASON_STORY: PnlBudgetSeasonStory[] = [
  { phase: 'winter_weak', label: 'Winter weak', months: 'Jan–Mar', note: 'Traffic soft after the holidays — Jan & Feb weakest; March still cautious.' },
  { phase: 'spring_up', label: 'Spring up', months: 'Apr–May', note: 'Demand rebuilds — revenue steps up from the winter floor.' },
  { phase: 'summer_stable', label: 'Summer stable', months: 'Jun–Aug', note: 'Peak / plateau — high months with a small decline into late summer.' },
  { phase: 'autumn_slow', label: 'Autumn slow', months: 'Sep–Nov', note: 'Traffic eases — softer covers before the year-end spike.' },
  { phase: 'december_strong', label: 'December strong', months: 'Dec', note: 'Strongest trading month — parties & year-end volume.' },
]

export type BuildPnlBudgetOpts = {
  venue?: AccountingPnlAnalyticsVenue
  mode?: PnlBudgetRevenueMode
  /** Average monthly revenue to scale the seasonal shape (default 160k). */
  targetAvgRevenue?: number
  /** Manual uplift/down vs seasonal shape (e.g. -5 = −5%). Ignored when mode=seasonal except still stored. */
  revenuePct?: number
  horizonMonths?: number
}

function resolveMode (raw: unknown): PnlBudgetRevenueMode {
  return raw === 'manual_pct' ? 'manual_pct' : 'seasonal'
}

function buildBaseline (rows: AccountingPnlRow[]): PnlBudgetBaselineRates | null {
  const clean = rows.filter((r) => r.revenue > 0 && !isOhStampMonth(r))
  if (!clean.length) return null

  let revenue = 0
  let cogs = 0
  let fixedLabor = 0
  let flexLabor = 0
  let fixed = 0
  for (const row of clean) {
    revenue += row.revenue
    cogs += row.cogs
    fixedLabor += fixedLaborFromRow(row)
    flexLabor += flexLaborFromRow(row)
    fixed += row.fixed
  }
  const n = clean.length
  const avgRev = revenue / n
  const avgCogs = cogs / n
  const avgFt = fixedLabor / n
  const avgFlex = flexLabor / n
  const avgOh = fixed / n
  const cogsPct = avgRev > 0 ? avgCogs / avgRev : 0
  const flexPct = avgRev > 0 ? avgFlex / avgRev : 0
  const cm = 1 - cogsPct - flexPct
  const fixedTotal = avgFt + avgOh
  const break_even = breakEvenFromTotals(avgRev, avgCogs, avgFt, avgFlex, avgOh)
  const revenue_for_target_margin = cm > PNL_BUDGET_TARGET_MARGIN + MIN_CM
    ? round2(fixedTotal / (cm - PNL_BUDGET_TARGET_MARGIN))
    : null

  return {
    months_used: n,
    avg_revenue: round2(avgRev),
    cogs_pct: round1(cogsPct * 100),
    flex_pct: round1(flexPct * 100),
    contribution_margin: round1(cm * 100),
    fixed_labor: round2(avgFt),
    fixed_oh: round2(avgOh),
    fixed_total: round2(fixedTotal),
    break_even: break_even != null ? round2(break_even) : null,
    revenue_for_target_margin,
  }
}

/** Calendar-month average revenue from clean sealed months (seasonal shape). */
function seasonalAvgByMonth (docs: Array<{ year: number; month: number; row: AccountingPnlRow }>): number[] {
  const sums = Array.from({ length: 12 }, () => 0)
  const counts = Array.from({ length: 12 }, () => 0)
  for (const d of docs) {
    if (d.row.revenue <= 0 || isOhStampMonth(d.row)) continue
    const i = d.month - 1
    sums[i]! += d.row.revenue
    counts[i]! += 1
  }
  const avgs = sums.map((s, i) => (counts[i]! > 0 ? s / counts[i]! : 0))
  const present = avgs.filter((v) => v > 0)
  const fallback = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 160_000
  return avgs.map((v) => (v > 0 ? v : fallback))
}

function scaleShape (shape: number[], targetAvg: number): number[] {
  const mean = shape.reduce((a, b) => a + b, 0) / shape.length
  if (mean <= 0) return shape.map(() => targetAvg)
  const k = targetAvg / mean
  return shape.map((v) => round2(v * k))
}

function buildEnvelope (
  revenue: number,
  fixedLabor: number,
  fixedOh: number,
): PnlBudgetCostEnvelope {
  const cost_budget = round2(revenue * (1 - PNL_BUDGET_TARGET_MARGIN))
  const cogs_budget = round2(revenue * PNL_BUDGET_TARGET_COGS_PCT)
  const labor_oh_budget = round2(cost_budget - cogs_budget)
  const flex_budget = round2(labor_oh_budget - fixedLabor - fixedOh)
  return {
    cost_budget,
    cogs_budget,
    labor_oh_budget,
    fixed_labor: round2(fixedLabor),
    fixed_oh: round2(fixedOh),
    flex_budget,
    flex_budget_ok: flex_budget >= -0.5,
  }
}

function weekFromMonth (envelope: PnlBudgetCostEnvelope, revenue: number, targetResult: number): PnlBudgetWeekSlice {
  const w = PNL_BUDGET_WEEKS_PER_MONTH
  return {
    revenue: round2(revenue / w),
    target_result: round2(targetResult / w),
    cost_budget: round2(envelope.cost_budget / w),
    cogs_budget: round2(envelope.cogs_budget / w),
    labor_oh_budget: round2(envelope.labor_oh_budget / w),
    fixed_labor: round2(envelope.fixed_labor / w),
    fixed_oh: round2(envelope.fixed_oh / w),
    flex_budget: round2(envelope.flex_budget / w),
  }
}

function monthBudget (
  year: number,
  month: number,
  revenue: number,
  baseline: PnlBudgetBaselineRates,
  targetAvg: number,
): PnlBudgetMonth {
  const cogsPct = baseline.cogs_pct / 100
  const flexPct = baseline.flex_pct / 100
  const cogs_at_rates = round2(revenue * cogsPct)
  const costs_at_rates = round2(revenue * (cogsPct + flexPct) + baseline.fixed_total)
  const result_at_rates = round2(revenue - costs_at_rates)
  const target_result = round2(revenue * PNL_BUDGET_TARGET_MARGIN)
  const envelope = buildEnvelope(revenue, baseline.fixed_labor, baseline.fixed_oh)
  const cogs_gap_vs_target = round2(cogs_at_rates - envelope.cogs_budget)
  const gap_to_target = round2(target_result - result_at_rates)
  const hits_target = gap_to_target <= 0.5
  const cut_fixed_needed = hits_target ? 0 : round2(Math.max(0, gap_to_target))
  const cut_variable_pp_needed = revenue > 0 && !hits_target
    ? round1((gap_to_target / revenue) * 100)
    : 0
  const season = seasonForMonth(month)
  const vs_avg_pct = targetAvg > 0 ? round1(((revenue - targetAvg) / targetAvg) * 100) : null

  return {
    date: monthKey(year, month),
    label: monthLabel(year, month),
    year,
    month,
    season: season.phase,
    season_label: season.label,
    vs_avg_pct,
    revenue: round2(revenue),
    target_result,
    max_costs: envelope.cost_budget,
    envelope,
    week: weekFromMonth(envelope, revenue, target_result),
    costs_at_rates,
    result_at_rates,
    result_pct_at_rates: revenue > 0 ? round1((result_at_rates / revenue) * 100) : null,
    cogs_at_rates,
    cogs_gap_vs_target,
    gap_to_target,
    hits_target,
    cut_fixed_needed,
    cut_variable_pp_needed,
  }
}

export async function buildPnlBudget (
  db: Db,
  opts: BuildPnlBudgetOpts = {},
): Promise<PnlBudgetDto> {
  const venue = opts.venue ?? 'combined'
  const mode = resolveMode(opts.mode)
  const horizon = Math.min(24, Math.max(1, opts.horizonMonths ?? 12))
  const revenuePct = Number.isFinite(opts.revenuePct) ? Number(opts.revenuePct) : 0
  const targetAvg = Number.isFinite(opts.targetAvgRevenue) && (opts.targetAvgRevenue ?? 0) > 0
    ? Number(opts.targetAvgRevenue)
    : 160_000

  const docs = await fetchSealedMonthlyPnlRows(db, { limit: null })
  const sealed = [...docs]
    .map((d) => ({ year: d.year, month: d.month, row: rowForVenue(d, venue) }))
    .sort((a, b) => a.year - b.year || a.month - b.month)

  const baseline = buildBaseline(sealed.map((s) => s.row))
  if (!baseline || !sealed.length) {
    return {
      venue,
      mode,
      target_margin: PNL_BUDGET_TARGET_MARGIN,
      target_cogs_pct: PNL_BUDGET_TARGET_COGS_PCT,
      weeks_per_month: PNL_BUDGET_WEEKS_PER_MONTH,
      target_avg_revenue: targetAvg,
      revenue_pct: revenuePct,
      horizon_months: horizon,
      baseline: {
        months_used: 0,
        avg_revenue: 0,
        cogs_pct: 0,
        flex_pct: 0,
        contribution_margin: 0,
        fixed_labor: 0,
        fixed_oh: 0,
        fixed_total: 0,
        break_even: null,
        revenue_for_target_margin: null,
      },
      season_story: SEASON_STORY,
      months: [],
      totals: {
        revenue: 0,
        target_result: 0,
        cost_budget: 0,
        cogs_budget: 0,
        labor_oh_budget: 0,
        flex_budget: 0,
        result_at_rates: 0,
        gap_to_target: 0,
        months_hitting_target: 0,
        months_flex_ok: 0,
      },
      notes: ['No sealed P&L months available for budget.'],
    }
  }

  const shape = seasonalAvgByMonth(sealed)
  let monthlyRevs = scaleShape(shape, targetAvg)
  if (mode === 'manual_pct') {
    const factor = 1 + revenuePct / 100
    monthlyRevs = monthlyRevs.map((v) => round2(v * factor))
  }

  const last = sealed[sealed.length - 1]!
  const start = addMonth(last.year, last.month, 1)
  const months: PnlBudgetMonth[] = []
  for (let i = 0; i < horizon; i++) {
    const ym = addMonth(start.year, start.month, i)
    const rev = monthlyRevs[ym.month - 1]!
    months.push(monthBudget(ym.year, ym.month, rev, baseline, targetAvg))
  }

  const totals = {
    revenue: round2(months.reduce((s, m) => s + m.revenue, 0)),
    target_result: round2(months.reduce((s, m) => s + m.target_result, 0)),
    cost_budget: round2(months.reduce((s, m) => s + m.envelope.cost_budget, 0)),
    cogs_budget: round2(months.reduce((s, m) => s + m.envelope.cogs_budget, 0)),
    labor_oh_budget: round2(months.reduce((s, m) => s + m.envelope.labor_oh_budget, 0)),
    flex_budget: round2(months.reduce((s, m) => s + m.envelope.flex_budget, 0)),
    result_at_rates: round2(months.reduce((s, m) => s + m.result_at_rates, 0)),
    gap_to_target: round2(months.reduce((s, m) => s + Math.max(0, m.gap_to_target), 0)),
    months_hitting_target: months.filter((m) => m.hits_target).length,
    months_flex_ok: months.filter((m) => m.envelope.flex_budget_ok).length,
  }

  const notes: string[] = [
    `Cost budget = revenue − ${(PNL_BUDGET_TARGET_MARGIN * 100).toFixed(0)}% result (= ${(100 - PNL_BUDGET_TARGET_MARGIN * 100).toFixed(0)}% of sales).`,
    `COGS target ${(PNL_BUDGET_TARGET_COGS_PCT * 100).toFixed(0)}% (menu margin 4). Labor+OH budget = cost − COGS; flex = that − fixed labor − fixed OH.`,
    `Weekly = monthly ÷ ${PNL_BUDGET_WEEKS_PER_MONTH} (same as Staff Org).`,
    `Rates from ${baseline.months_used} clean sealed months (OH-stamp months excluded). Actual COGS ${baseline.cogs_pct.toFixed(1)}% vs target ${(PNL_BUDGET_TARGET_COGS_PCT * 100).toFixed(0)}%.`,
    'Seasonal €: winter weak → spring up → summer stable → autumn slow → December strong.',
  ]
  if (baseline.break_even != null) {
    notes.push(`Break-even at current rates ≈ ${Math.round(baseline.break_even).toLocaleString('nl-NL')} €/mo.`)
  }
  if (baseline.revenue_for_target_margin != null) {
    notes.push(
      `Need ≈ ${Math.round(baseline.revenue_for_target_margin).toLocaleString('nl-NL')} €/mo revenue for 10% at current rates (no cost cuts).`,
    )
  }
  if (mode === 'seasonal') {
    notes.push(`Revenue = seasonal shape scaled to ${Math.round(targetAvg).toLocaleString('nl-NL')} € avg/mo.`)
  } else {
    notes.push(
      `Revenue = seasonal shape @ ${Math.round(targetAvg).toLocaleString('nl-NL')} € avg, then ${revenuePct >= 0 ? '+' : ''}${revenuePct}% for the season.`,
    )
  }

  return {
    venue,
    mode,
    target_margin: PNL_BUDGET_TARGET_MARGIN,
    target_cogs_pct: PNL_BUDGET_TARGET_COGS_PCT,
    weeks_per_month: PNL_BUDGET_WEEKS_PER_MONTH,
    target_avg_revenue: round2(targetAvg),
    revenue_pct: round2(revenuePct),
    horizon_months: horizon,
    baseline,
    season_story: SEASON_STORY,
    months,
    totals,
    notes,
  }
}
