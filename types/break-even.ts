/**
 * @registry-id: breakEvenTypes
 * @created: 2026-07-24T11:30:00.000Z
 * @last-modified: 2026-08-09T01:05:00.000Z
 * @description: Break-even assumptions + metrics DTO types
 * @last-fix: [2026-08-09] @adr-ref + PERIOD_CACHE_ADR (BE GET = period-cache)
 *   Prior: [2026-08-05] estimatedNet (ops-rev CM) vs accountingResult (sealed Finance only)
 * @adr-ref: ADR-013, ADR-014, ADR-019, ADR-022, PERIOD_CACHE_ADR L2, L4
 *
 * @exports-to:
 * ✓ utils/accountingPnlBreakEvenMath.ts
 * ✓ server/utils/appSettings/breakEvenAssumptionsSetting.ts
 * ✓ server/api/daily-ops/metrics/break-even.get.ts
 * ✓ server/utils/dailyOpsPeriodCache/resolveBreakEvenFromPeriodCache.ts
 */

import type { AccountingPnlVenueId } from '~/utils/accountingPnlData'

export type BreakEvenVenueKey = AccountingPnlVenueId | 'combined'

/** `blended` = period spans both sealed Finance months and rolling open months. */
export type BreakEvenSource = 'actual_month' | 'rolling_12m' | 'blended' | 'default'

/** Per-venue slice stored in app_settings.break_even_assumptions */
export type BreakEvenVenueSlice = {
  venueId: BreakEvenVenueKey
  /** Monthly break-even revenue € = (fixedLabor + fixed) / (1 − cogs% − flexLaborRate) */
  monthlyBreakEven: number
  monthlyRevenue: number
  /** Total labor € (FT + flex) for the averaged / actual month */
  monthlyLabor: number
  monthlyFixedLabor: number
  monthlyFlexLabor: number
  monthlyCogs: number
  monthlyFixed: number
  cogsPct: number
  /** Combined labor % of revenue (fixedLabor + flexLabor) */
  laborPct: number
  fixedLaborPct: number
  flexLaborPct: number
  source: BreakEvenSource
  year: number | null
  month: number | null
  monthsInWindow: number
}

export type BreakEvenAssumptionsValue = {
  schemaVersion: 1
  rollingWindowMonths: 12
  computedAt: string
  /** Rolling 12-month averages — used for open months / daily projection */
  rolling: Record<BreakEvenVenueKey, BreakEvenVenueSlice>
  /** Closed months with actual BE — key `YYYY-MM` */
  actualByMonth: Record<string, Record<BreakEvenVenueKey, BreakEvenVenueSlice>>
}

export type DailyOpsBreakEvenDto = {
  venueId: BreakEvenVenueKey
  locationId: string | null
  locationName?: string
  /** Period break-even revenue target (€) */
  breakEven: number
  /** Actual / headline revenue for the period (€) */
  revenue: number
  /** (revenue − breakEven) / breakEven × 100 — null for today (no %) */
  pctVsBreakEven: number | null
  source: BreakEvenSource
  granularity: 'day' | 'week' | 'month' | 'year'
  year: number | null
  month: number | null
  monthsInWindow: number
  monthlyBreakEven: number
  cogsPct: number
  laborPct: number
  fixedLaborPct: number
  flexLaborPct: number
  /**
 * Sum of sealed Finance P&L `result` for sealed months in the period only.
 * Never a CM estimate — UI may label this "Finance P&L".
 */
  accountingResult: number | null
  /**
   * Period Est. net for display (ADR-022):
   * sealed Finance result(s) + CM estimate on **ops headline revenue** for open spans.
   * Null only when neither sealed nor CM estimate is available.
   */
  estimatedNet: number | null
}

/** Combined + per-venue break-even (one assumptions load). */
export type DailyOpsBreakEvenBundleDto = DailyOpsBreakEvenDto & {
  byVenue: DailyOpsBreakEvenDto[]
}
