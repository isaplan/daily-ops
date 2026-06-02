import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'
import { DEFAULT_PNL_ASSUMPTIONS, normalizePnlAssumptions } from '~/utils/dailyOpsPnlAssumptionsDefaults'

export { DEFAULT_PNL_ASSUMPTIONS }

/** @deprecated Prefer loadPnlAssumptions(db) — query override kept for backwards-compatible tests only. */
export function parsePnlAssumptions(q: Record<string, unknown>): DailyOpsSimplePnLAssumptions {
  const food = Number(q.foodCogsPct)
  const bev = Number(q.bevCogsPct)
  const overhead = Number(q.overheadPct)
  const hasOverride =
    Number.isFinite(food) || Number.isFinite(bev) || Number.isFinite(overhead)
  if (!hasOverride) return { ...DEFAULT_PNL_ASSUMPTIONS }
  return normalizePnlAssumptions({
    foodCogsPct: Number.isFinite(food) ? food : DEFAULT_PNL_ASSUMPTIONS.foodCogsPct,
    bevCogsPct: Number.isFinite(bev) ? bev : DEFAULT_PNL_ASSUMPTIONS.bevCogsPct,
    overheadPct: Number.isFinite(overhead) ? overhead : DEFAULT_PNL_ASSUMPTIONS.overheadPct,
  })
}
