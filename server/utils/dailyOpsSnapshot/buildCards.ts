/**
 * @registry-id: dailyOpsSnapshotBuildCards
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-13T09:20:00.000Z
 * @description: Computes master.cards (headline KPIs) from the revenue + labor sections.
 *   Single point of truth for revenue/labor/productivity calculations on the dashboard.
 * @last-fix: [2026-05-13] Coerce DEBUG to string before .includes (boolean env).
 *
 * @architecture:
 *   - Revenue: takes section.totals (lead source already resolved upstream).
 *   - Labor: takes section.totals (wage + loaded).
 *   - Productivity ratios: ex_vat revenue / hours; cost / ex_vat revenue. Returns null
 *     when denominator is 0 to avoid divide-by-zero in UI.
 *
 * @exports-to:
 *   ✓ server/services/dailyOpsSnapshotService.ts
 */

import type {
  DailyOpsSnapshotLaborSection,
  DailyOpsSnapshotMaster,
  DailyOpsSnapshotRevenueSection,
} from '../../../types/daily-ops-snapshot'

const DEBUG = String(process.env.DEBUG ?? '').includes('snapshot:build')

export function buildCards(
  revenue: DailyOpsSnapshotRevenueSection,
  labor: DailyOpsSnapshotLaborSection
): DailyOpsSnapshotMaster['cards'] {
  const revEx = revenue.totals.ex_vat
  const revInc = revenue.totals.inc_vat
  const revVat = revenue.totals.vat
  const hours = labor.totals.hours
  const wage = labor.totals.wage_cost
  const loaded = labor.totals.loaded_cost

  const safeDiv = (a: number, b: number): number | null => (b > 0 ? a / b : null)

  const cards: DailyOpsSnapshotMaster['cards'] = {
    revenue: { ex_vat: revEx, inc_vat: revInc, vat: revVat },
    labor: { wage_cost: wage, loaded_cost: loaded, hours },
    productivity: {
      revenue_per_hour: safeDiv(revEx, hours),
      wage_cost_pct: safeDiv(wage, revEx),
      loaded_cost_pct: safeDiv(loaded, revEx),
    },
  }

  if (DEBUG) {
    console.info(
      `[snapshot:build] ${revenue.businessDate} ${revenue.locationName} | cards | rev_ex=${revEx.toFixed(2)} hours=${hours.toFixed(2)} wage=${wage.toFixed(2)} loaded=${loaded.toFixed(2)} ` +
        `rev/h=${cards.productivity.revenue_per_hour?.toFixed(2) ?? 'null'} wage%=${cards.productivity.wage_cost_pct?.toFixed(3) ?? 'null'}`
    )
  }

  return cards
}
