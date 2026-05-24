import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'

export const DEFAULT_PNL_ASSUMPTIONS: DailyOpsSimplePnLAssumptions = {
  foodCogsPct: 30,
  bevCogsPct: 4,
  overheadPct: 25,
}

export function parsePnlAssumptions(q: Record<string, unknown>): DailyOpsSimplePnLAssumptions {
  const food = Number(q.foodCogsPct)
  const bev = Number(q.bevCogsPct)
  const overhead = Number(q.overheadPct)
  return {
    foodCogsPct: Number.isFinite(food) && food >= 0 ? food : DEFAULT_PNL_ASSUMPTIONS.foodCogsPct,
    bevCogsPct: Number.isFinite(bev) && bev >= 0 ? bev : DEFAULT_PNL_ASSUMPTIONS.bevCogsPct,
    overheadPct:
      Number.isFinite(overhead) && overhead >= 0 ? overhead : DEFAULT_PNL_ASSUMPTIONS.overheadPct,
  }
}
