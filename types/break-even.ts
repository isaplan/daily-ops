/**
 * @registry-id: breakEvenTypes
 * @created: 2026-07-24T11:30:00.000Z
 * @last-modified: 2026-07-24T11:30:00.000Z
 * @description: Break-even assumptions + metrics DTO types
 * @last-fix: [2026-07-24] Initial break-even types (rolling 12m + actual month)
 * @adr-ref: ADR-014
 *
 * @exports-to:
 * ✓ utils/accountingPnlBreakEvenMath.ts
 * ✓ server/utils/appSettings/breakEvenAssumptionsSetting.ts
 * ✓ server/api/daily-ops/metrics/break-even.get.ts
 */

import type { AccountingPnlVenueId } from '~/utils/accountingPnlData'

export type BreakEvenVenueKey = AccountingPnlVenueId | 'combined'

export type BreakEvenSource = 'actual_month' | 'rolling_12m' | 'default'

/** Per-venue slice stored in app_settings.break_even_assumptions */
export type BreakEvenVenueSlice = {
  venueId: BreakEvenVenueKey
  /** Monthly break-even revenue € = (labor + fixed) / (1 − cogs%) */
  monthlyBreakEven: number
  monthlyRevenue: number
  monthlyLabor: number
  monthlyCogs: number
  monthlyFixed: number
  cogsPct: number
  laborPct: number
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
  granularity: 'day' | 'week' | 'month'
  year: number | null
  month: number | null
  monthsInWindow: number
  monthlyBreakEven: number
  cogsPct: number
  laborPct: number
}

/** Combined + per-venue break-even (one assumptions load). */
export type DailyOpsBreakEvenBundleDto = DailyOpsBreakEvenDto & {
  byVenue: DailyOpsBreakEvenDto[]
}
