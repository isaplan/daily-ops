/**
 * @registry-id: accountingPnlBudgetTypes
 * @created: 2026-08-12T00:15:00.000Z
 * @last-modified: 2026-08-12T00:40:00.000Z
 * @description: Finance Analytics budget/forecast DTO — 10% margin cost envelope + COGS/labor split
 * @last-fix: [2026-08-12] Phase 1: cost=rev−10%, COGS@25%, fixed vs flex, weekly slice
 * @adr-ref: ADR-019, ADR-022
 *
 * @exports-to:
 * ✓ server/utils/accountingPnl/buildPnlBudget.ts
 * ✓ server/api/daily-ops/finance/analytics/budget.get.ts
 * ✓ components/daily-ops/finance/PnlBudgetForecastCard.vue
 * ✓ pages/daily-ops/finance/analytics.vue
 */

import type { AccountingPnlAnalyticsVenue } from '~/types/accounting-pnl-analytics'

/** Target net result / revenue every budget month. */
export const PNL_BUDGET_TARGET_MARGIN = 0.1

/**
 * Food+bev COGS target from menu margin 4 (selling = 4× cost → cost = 25% of price).
 */
export const PNL_BUDGET_TARGET_COGS_PCT = 0.25

/** Align with Staff Org weekly slice (monthly ÷ 4). */
export const PNL_BUDGET_WEEKS_PER_MONTH = 4

/**
 * seasonal — shape from sealed YoY months, scaled to target_avg_revenue
 * manual_pct — same seasonal shape × (1 + revenue_pct/100)
 */
export type PnlBudgetRevenueMode = 'seasonal' | 'manual_pct'

export type PnlBudgetBaselineRates = {
  /** Clean sealed months used for rates (excludes Dec OH-stamp months). */
  months_used: number
  avg_revenue: number
  /** Actual sealed COGS % (not the 25% target). */
  cogs_pct: number
  flex_pct: number
  contribution_margin: number
  fixed_labor: number
  fixed_oh: number
  fixed_total: number
  break_even: number | null
  /** Revenue needed for 10% margin at these rates. */
  revenue_for_target_margin: number | null
}

/** Ops seasonal phases — shape still comes from sealed history. */
export type PnlBudgetSeasonPhase =
  | 'winter_weak'
  | 'spring_up'
  | 'summer_stable'
  | 'autumn_slow'
  | 'december_strong'

/** Team-facing cost envelope for one month (and weekly ÷ 4). */
export type PnlBudgetCostEnvelope = {
  /** revenue − 10% result = 90% × revenue */
  cost_budget: number
  /** 25% × revenue (margin-4 menu target) */
  cogs_budget: number
  /** cost_budget − cogs_budget */
  labor_oh_budget: number
  /** Actual fixed labor € (from sealed baseline) */
  fixed_labor: number
  /** Actual fixed OH € (from sealed baseline) */
  fixed_oh: number
  /** labor_oh_budget − fixed_labor − fixed_oh (can be negative = over-fixed) */
  flex_budget: number
  flex_budget_ok: boolean
}

export type PnlBudgetWeekSlice = {
  revenue: number
  target_result: number
  cost_budget: number
  cogs_budget: number
  labor_oh_budget: number
  fixed_labor: number
  fixed_oh: number
  flex_budget: number
}

export type PnlBudgetMonth = {
  date: string
  label: string
  year: number
  month: number
  season: PnlBudgetSeasonPhase
  season_label: string
  /** vs target avg (e.g. −18 = soft month) */
  vs_avg_pct: number | null
  revenue: number
  /** 10% × revenue */
  target_result: number
  /** Alias of envelope.cost_budget — max total costs for 10% */
  max_costs: number
  envelope: PnlBudgetCostEnvelope
  /** Monthly ÷ 4 (Staff Org aligned) */
  week: PnlBudgetWeekSlice
  /** Costs if current clean rates hold (variable % + fixed €) */
  costs_at_rates: number
  result_at_rates: number
  result_pct_at_rates: number | null
  /** Actual sealed COGS € at baseline cogs% × revenue */
  cogs_at_rates: number
  /** Gap vs 25% COGS target (>0 = over target) */
  cogs_gap_vs_target: number
  /** target_result − result_at_rates (>0 = shortfall) */
  gap_to_target: number
  hits_target: boolean
  /** €/mo fixed cut to hit 10% at this revenue (0 if already ok) */
  cut_fixed_needed: number
  /** pp COGS (or flex) cut to hit 10% at this revenue */
  cut_variable_pp_needed: number
}

export type PnlBudgetSeasonStory = {
  phase: PnlBudgetSeasonPhase
  label: string
  months: string
  note: string
}

export type PnlBudgetDto = {
  venue: AccountingPnlAnalyticsVenue
  mode: PnlBudgetRevenueMode
  target_margin: number
  target_cogs_pct: number
  weeks_per_month: number
  target_avg_revenue: number
  revenue_pct: number
  horizon_months: number
  baseline: PnlBudgetBaselineRates
  /** Fixed narrative of the annual traffic pattern. */
  season_story: PnlBudgetSeasonStory[]
  months: PnlBudgetMonth[]
  totals: {
    revenue: number
    target_result: number
    cost_budget: number
    cogs_budget: number
    labor_oh_budget: number
    flex_budget: number
    result_at_rates: number
    gap_to_target: number
    months_hitting_target: number
    months_flex_ok: number
  }
  notes: string[]
}
