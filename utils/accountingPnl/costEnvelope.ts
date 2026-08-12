/**
 * @registry-id: accountingPnlCostEnvelope
 * @created: 2026-08-12T00:45:00.000Z
 * @last-modified: 2026-08-12T00:45:00.000Z
 * @description: Pure cost envelope: rev−10% result, COGS@25%, labor+OH pot, flex leftover
 * @last-fix: [2026-08-12] Phase 2 shared util for Finance budget + Staff Org seed
 * @adr-ref: ADR-016, ADR-019, ADR-022
 *
 * @exports-to:
 * ✓ server/utils/accountingPnl/buildPnlBudget.ts
 * ✓ server/utils/staffOrg/laborBenchmarks.ts
 * ✓ utils/staffOrg/locationTargets.ts
 * ✓ components/staffOrg/StaffOrgVenueBudgetCard.vue
 */

import {
  PNL_BUDGET_TARGET_COGS_PCT,
  PNL_BUDGET_TARGET_MARGIN,
  PNL_BUDGET_WEEKS_PER_MONTH,
} from '~/types/accounting-pnl-budget'

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

export type PnlCostEnvelope = {
  revenue: number
  target_result: number
  cost_budget: number
  cogs_budget: number
  labor_oh_budget: number
  fixed_labor: number
  fixed_oh: number
  flex_budget: number
  flex_budget_ok: boolean
}

export type PnlCostEnvelopeWeek = {
  revenue: number
  target_result: number
  cost_budget: number
  cogs_budget: number
  labor_oh_budget: number
  fixed_labor: number
  fixed_oh: number
  flex_budget: number
}

/** cost = revenue − 10% result; COGS@25%; flex = labor+OH pot − fixed labor − fixed OH. */
export function buildPnlCostEnvelope (
  revenue: number,
  fixedLabor: number,
  fixedOh: number,
): PnlCostEnvelope {
  const rev = Number.isFinite(revenue) && revenue > 0 ? revenue : 0
  const fl = Number.isFinite(fixedLabor) ? fixedLabor : 0
  const oh = Number.isFinite(fixedOh) ? fixedOh : 0
  const target_result = round2(rev * PNL_BUDGET_TARGET_MARGIN)
  const cost_budget = round2(rev * (1 - PNL_BUDGET_TARGET_MARGIN))
  const cogs_budget = round2(rev * PNL_BUDGET_TARGET_COGS_PCT)
  const labor_oh_budget = round2(cost_budget - cogs_budget)
  const flex_budget = round2(labor_oh_budget - fl - oh)
  return {
    revenue: round2(rev),
    target_result,
    cost_budget,
    cogs_budget,
    labor_oh_budget,
    fixed_labor: round2(fl),
    fixed_oh: round2(oh),
    flex_budget,
    flex_budget_ok: flex_budget >= -0.5,
  }
}

export function weekSliceFromEnvelope (env: PnlCostEnvelope): PnlCostEnvelopeWeek {
  const w = PNL_BUDGET_WEEKS_PER_MONTH
  return {
    revenue: round2(env.revenue / w),
    target_result: round2(env.target_result / w),
    cost_budget: round2(env.cost_budget / w),
    cogs_budget: round2(env.cogs_budget / w),
    labor_oh_budget: round2(env.labor_oh_budget / w),
    fixed_labor: round2(env.fixed_labor / w),
    fixed_oh: round2(env.fixed_oh / w),
    flex_budget: round2(env.flex_budget / w),
  }
}

/** Labor % of revenue implied by envelope (FT fixed + flex leftover). */
export function laborPctTargetsFromEnvelope (env: PnlCostEnvelope): {
  total: number | null
  ft: number | null
  flex: number | null
} {
  if (!(env.revenue > 0)) return { total: null, ft: null, flex: null }
  const ft = Math.round((env.fixed_labor / env.revenue) * 1000) / 10
  const flex = Math.round((Math.max(0, env.flex_budget) / env.revenue) * 1000) / 10
  const total = Math.round(((env.fixed_labor + Math.max(0, env.flex_budget)) / env.revenue) * 1000) / 10
  return { total, ft, flex }
}
