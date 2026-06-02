import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'

/** Shared defaults for P&L assumptions (client + server). */
export const DEFAULT_PNL_ASSUMPTIONS: DailyOpsSimplePnLAssumptions = {
  foodCogsPct: 30,
  bevCogsPct: 30,
  overheadPct: 25,
}

export function clampPnlPct(n: unknown, fallback: number): number {
  const value = Number(n)
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : fallback
}

export function normalizePnlAssumptions(raw: Partial<DailyOpsSimplePnLAssumptions>): DailyOpsSimplePnLAssumptions {
  return {
    foodCogsPct: clampPnlPct(raw.foodCogsPct, DEFAULT_PNL_ASSUMPTIONS.foodCogsPct),
    bevCogsPct: clampPnlPct(raw.bevCogsPct, DEFAULT_PNL_ASSUMPTIONS.bevCogsPct),
    overheadPct: clampPnlPct(raw.overheadPct, DEFAULT_PNL_ASSUMPTIONS.overheadPct),
  }
}
