/**
 * @registry-id: buildPnlBudget
 * @created: 2026-08-12T00:15:00.000Z
 * @last-modified: 2026-08-12T01:50:00.000Z
 * @description: 10% margin budget/forecast — cost envelope, seasons, plain-language summaries
 * @last-fix: [2026-08-12] Season groups + vs_season_pct + team-facing plain summaries
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
  PnlBudgetSeasonGroup,
  PnlBudgetSeasonPhase,
  PnlBudgetSeasonStory,
  PnlBudgetWeekSlice,
} from '~/types/accounting-pnl-budget'
import {
  PNL_BUDGET_TARGET_COGS_PCT,
  PNL_BUDGET_TARGET_MARGIN,
  PNL_BUDGET_WEEKS_PER_MONTH,
} from '~/types/accounting-pnl-budget'
import {
  buildPnlCostEnvelope,
  weekSliceFromEnvelope,
} from '~/utils/accountingPnl/costEnvelope'
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
  if (month >= 1 && month <= 3) return { phase: 'winter_weak', label: 'Winter (quiet)' }
  if (month >= 4 && month <= 5) return { phase: 'spring_up', label: 'Spring (building)' }
  if (month >= 6 && month <= 8) return { phase: 'summer_stable', label: 'Summer (steady)' }
  if (month >= 9 && month <= 11) return { phase: 'autumn_slow', label: 'Autumn (easing)' }
  return { phase: 'december_strong', label: 'December (strong)' }
}

const SEASON_STORY: PnlBudgetSeasonStory[] = [
  { phase: 'winter_weak', label: 'Winter (quiet)', months: 'Jan–Mar', note: 'Quieter after the holidays. January and February are usually the softest.' },
  { phase: 'spring_up', label: 'Spring (building)', months: 'Apr–May', note: 'Sales pick up from the winter floor as the year warms up.' },
  { phase: 'summer_stable', label: 'Summer (steady)', months: 'Jun–Aug', note: 'Busy, fairly steady months — often the high plateau of the year.' },
  { phase: 'autumn_slow', label: 'Autumn (easing)', months: 'Sep–Nov', note: 'Traffic eases a bit before the year-end rush.' },
  { phase: 'december_strong', label: 'December (strong)', months: 'Dec', note: 'Strongest month — parties and year-end volume.' },
]

const SEASON_ORDER: PnlBudgetSeasonPhase[] = [
  'winter_weak',
  'spring_up',
  'summer_stable',
  'autumn_slow',
  'december_strong',
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

function fmtEurPlain (n: number): string {
  return `€${Math.round(n).toLocaleString('nl-NL')}`
}

function vsAvgPhrase (pct: number | null, vsWhat: string): string {
  if (pct == null || !Number.isFinite(pct)) return `about the same as ${vsWhat}`
  if (Math.abs(pct) < 2) return `about the same as ${vsWhat}`
  if (pct > 0) return `about ${Math.abs(pct).toFixed(0)}% busier than ${vsWhat}`
  return `about ${Math.abs(pct).toFixed(0)}% quieter than ${vsWhat}`
}

function monthPlainSummary (m: Omit<PnlBudgetMonth, 'plain_summary' | 'vs_season_pct'>): string {
  const spend = fmtEurPlain(m.envelope.cost_budget)
  const food = fmtEurPlain(m.envelope.cogs_budget)
  const flex = fmtEurPlain(m.envelope.flex_budget)
  if (!m.envelope.flex_budget_ok) {
    return `${m.label}: expect ${fmtEurPlain(m.revenue)} sales. You can spend up to ${spend} (keep ${fmtEurPlain(m.target_result)} as 10% profit). Food & drinks target ${food}. Fixed costs already use the whole labor+OH pot — no flex room this month.`
  }
  return `${m.label}: expect ${fmtEurPlain(m.revenue)} sales. Spend up to ${spend} total (${food} food & drinks; ${flex} left for flexible staff after fixed labor & overhead).`
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
  const env = buildPnlCostEnvelope(revenue, fixedLabor, fixedOh)
  return {
    cost_budget: env.cost_budget,
    cogs_budget: env.cogs_budget,
    labor_oh_budget: env.labor_oh_budget,
    fixed_labor: env.fixed_labor,
    fixed_oh: env.fixed_oh,
    flex_budget: env.flex_budget,
    flex_budget_ok: env.flex_budget_ok,
  }
}

function weekFromMonth (envelope: PnlBudgetCostEnvelope, revenue: number): PnlBudgetWeekSlice {
  const full = buildPnlCostEnvelope(revenue, envelope.fixed_labor, envelope.fixed_oh)
  const w = weekSliceFromEnvelope(full)
  return {
    revenue: w.revenue,
    target_result: w.target_result,
    cost_budget: w.cost_budget,
    cogs_budget: w.cogs_budget,
    labor_oh_budget: w.labor_oh_budget,
    fixed_labor: w.fixed_labor,
    fixed_oh: w.fixed_oh,
    flex_budget: w.flex_budget,
  }
}

function monthBudgetDraft (
  year: number,
  month: number,
  revenue: number,
  baseline: PnlBudgetBaselineRates,
  targetAvg: number,
): Omit<PnlBudgetMonth, 'plain_summary' | 'vs_season_pct'> {
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
    week: weekFromMonth(envelope, revenue),
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

function groupSeasons (months: PnlBudgetMonth[], targetAvg: number): PnlBudgetSeasonGroup[] {
  const byPhase = new Map<PnlBudgetSeasonPhase, PnlBudgetMonth[]>()
  for (const m of months) {
    const list = byPhase.get(m.season) ?? []
    list.push(m)
    byPhase.set(m.season, list)
  }

  const groups: PnlBudgetSeasonGroup[] = []
  const appearance = months.map((m) => m.season).filter((p, i, arr) => arr.indexOf(p) === i)
  const ordered = [
    ...appearance,
    ...SEASON_ORDER.filter((p) => !appearance.includes(p) && byPhase.has(p)),
  ]

  for (const phase of ordered) {
    const list = byPhase.get(phase)
    if (!list?.length) continue
    const story = SEASON_STORY.find((s) => s.phase === phase)!
    const avg_revenue = round2(list.reduce((s, m) => s + m.revenue, 0) / list.length)
    const vs_year_avg_pct = targetAvg > 0
      ? round1(((avg_revenue - targetAvg) / targetAvg) * 100)
      : null
    groups.push({
      phase,
      label: story.label,
      months_label: story.months,
      note: story.note,
      avg_revenue,
      vs_year_avg_pct,
      plain_summary: `${story.label} (${story.months}): ${vsAvgPhrase(vs_year_avg_pct, 'your year average')}. ${story.note}`,
      months: list,
    })
  }
  return groups
}

function emptyDto (
  venue: AccountingPnlAnalyticsVenue,
  mode: PnlBudgetRevenueMode,
  targetAvg: number,
  revenuePct: number,
  horizon: number,
): PnlBudgetDto {
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
    seasons: [],
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
    return emptyDto(venue, mode, targetAvg, revenuePct, horizon)
  }

  const shape = seasonalAvgByMonth(sealed)
  let monthlyRevs = scaleShape(shape, targetAvg)
  if (mode === 'manual_pct') {
    const factor = 1 + revenuePct / 100
    monthlyRevs = monthlyRevs.map((v) => round2(v * factor))
  }

  const last = sealed[sealed.length - 1]!
  const start = addMonth(last.year, last.month, 1)
  const drafts: Array<Omit<PnlBudgetMonth, 'plain_summary' | 'vs_season_pct'>> = []
  for (let i = 0; i < horizon; i++) {
    const ym = addMonth(start.year, start.month, i)
    const rev = monthlyRevs[ym.month - 1]!
    drafts.push(monthBudgetDraft(ym.year, ym.month, rev, baseline, targetAvg))
  }

  const seasonAvgs = new Map<PnlBudgetSeasonPhase, number>()
  for (const phase of SEASON_ORDER) {
    const list = drafts.filter((m) => m.season === phase)
    if (!list.length) continue
    seasonAvgs.set(phase, list.reduce((s, m) => s + m.revenue, 0) / list.length)
  }

  const months: PnlBudgetMonth[] = drafts.map((d) => {
    const seasonAvg = seasonAvgs.get(d.season)
    const vs_season_pct = seasonAvg && seasonAvg > 0
      ? round1(((d.revenue - seasonAvg) / seasonAvg) * 100)
      : null
    return {
      ...d,
      vs_season_pct,
      plain_summary: monthPlainSummary(d),
    }
  })

  const seasons = groupSeasons(months, targetAvg)

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
    'Keep 10% of sales as profit. Everything else is your cost budget.',
    'Food & drinks should stay near 25% of sales (menu priced at margin 4).',
    'After fixed staff and overhead, what’s left is the flex staff budget.',
    `A week is 1/${PNL_BUDGET_WEEKS_PER_MONTH} of the month (same as Staff Org).`,
    `Numbers use ${baseline.months_used} clean sealed months (odd OH credits skipped).`,
  ]
  if (mode === 'seasonal') {
    notes.push(`Sales follow your sealed seasonal shape, scaled to ${fmtEurPlain(targetAvg)} average per month.`)
  } else {
    notes.push(
      `Sales follow the seasonal shape at ${fmtEurPlain(targetAvg)} average, then ${revenuePct >= 0 ? '+' : ''}${revenuePct}% across the horizon.`,
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
    seasons,
    months,
    totals,
    notes,
  }
}
