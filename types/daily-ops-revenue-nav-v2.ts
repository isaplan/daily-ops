/**
 * @registry-id: dailyOpsRevenueNavV2Types
 * @created: 2026-06-08T00:00:00.000Z
 * @last-modified: 2026-06-08T00:00:00.000Z
 * @description: Revenue Nav V2 — mode, slot, compare types (ADR-011)
 * @adr-ref: ADR-011
 *
 * @exports-to:
 * ✓ utils/dailyOpsRevenueNavV2/modes.ts
 * ✓ utils/dailyOpsRevenueNavV2/resolveRange.ts
 * ✓ composables/useDailyOpsRevenueNavV2.ts
 * ✓ components/daily-ops/revenue/nav-v2/*
 */

/** Primary mode bar tabs. */
export const REVENUE_NAV_V2_MODES = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'seasonal',
  'menu',
  'period',
] as const

export type RevenueNavV2Mode = (typeof REVENUE_NAV_V2_MODES)[number]

/**
 * Child slot IDs per mode.
 * Reuses existing DailyOpsRevenuePeriodId where possible.
 * New V2-only IDs: w-2, w-3 (rolling weeks), m-YYYY-MM (calendar month by key).
 */
export type RevenueNavV2Slot =
  // daily
  | 'today' | 'yesterday' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7'
  // weekly
  | 'this-week' | 'last-week' | 'w-2' | 'w-3'
  // monthly — static + dynamic m-YYYY-MM
  | 'this-month' | 'last-month' | `m-${string}`
  // quarterly
  | 'q1' | 'q2' | 'q3' | 'q4' | 'last-q'
  // yearly
  | 'this-year' | 'last-year' | 'year-2'
  // seasonal — current + prior year via slot e.g. 'spring', 'spring-1'
  | 'spring' | 'summer' | 'autumn' | 'winter'
  | 'spring-1' | 'summer-1' | 'autumn-1' | 'winter-1'
  // menu
  | 'menu-all' | 'menu-drinks' | 'menu-food' | `menu-${string}`
  // period (rolling + granularity)
  | 'last-7d' | 'last-14d' | 'last-28d' | 'last-6w' | 'last-12w' | 'last-24w' | 'last-12m'

/** Granularity for Period mode charts. */
export type RevenueNavV2Granularity = 'day' | 'week' | 'month'

/** Resolved date range + metadata for API queries. */
export type RevenueNavV2Range = {
  startDate: string
  endDate: string
  label: string
  bucket: RevenueNavV2Granularity
}

/** A named child slot option shown in the child bar. */
export type RevenueNavV2SlotOption = {
  id: RevenueNavV2Slot
  label: string
  /** Short label for narrow viewports. */
  short?: string
}

/** Full V2 query state — synced to URL. */
export type RevenueNavV2Query = {
  mode: RevenueNavV2Mode
  slot: RevenueNavV2Slot
  location: string | null
  space: string | null
  compare: boolean
  compareSlots: RevenueNavV2Slot[]
  granularity: RevenueNavV2Granularity
  /** Calendar date override for daily date-picker (YYYY-MM-DD). */
  pick: string | null
}
