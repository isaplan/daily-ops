/**
 * @registry-id: accountingPnlAnalyticsTypes
 * @created: 2026-08-11T12:55:00.000Z
 * @last-modified: 2026-08-11T14:40:00.000Z
 * @description: Finance Analytics DTO — sealed monthly P&L series + narrative
 * @last-fix: [2026-08-11] Staff point includes gewerkt hours by contract
 * @adr-ref: ADR-022, ADR-004
 *
 * @exports-to:
 * ✓ server/utils/accountingPnl/buildPnlAnalytics.ts
 * ✓ server/api/daily-ops/finance/analytics.get.ts
 * ✓ server/api/daily-ops/finance/analytics/staff.get.ts
 * ✓ pages/daily-ops/finance/analytics.vue
 * ✓ components/daily-ops/finance/PnlAnalyticsTrendChart.vue
 */

import type { AccountingPnlVenueId } from '~/utils/accountingPnlData'

export type AccountingPnlAnalyticsVenue = AccountingPnlVenueId | 'combined'

export type AccountingPnlAnalyticsPoint = {
  date: string
  label: string
  year: number
  month: number
  revenue: number
  labor: number
  cogs: number
  fixed: number
  result: number
  labor_pct: number | null
  cogs_pct: number | null
  result_pct: number | null
}

/** Unique active workers + gewerkt hours in the month (period-cache), split by contract. */
export type AccountingPnlAnalyticsStaffPoint = {
  date: string
  staff_count: number
  ft: number
  pt: number
  zzp: number
  hours: number
  hours_ft: number
  hours_pt: number
  hours_zzp: number
}

export type AccountingPnlAnalyticsVerdict = {
  headline: string
  bullets: string[]
}

export type AccountingPnlAnalyticsSeasonal = {
  month: number
  month_label: string
  current_year: number
  prior_year: number
  current_revenue: number
  prior_revenue: number
  revenue_pct: number | null
  note: string
}

export type AccountingPnlAnalyticsDto = {
  venue: AccountingPnlAnalyticsVenue
  range_label: string
  month_count: number
  series: AccountingPnlAnalyticsPoint[]
  staff_series: AccountingPnlAnalyticsStaffPoint[]
  verdict: AccountingPnlAnalyticsVerdict
  seasonal: AccountingPnlAnalyticsSeasonal[]
  latest: AccountingPnlAnalyticsPoint | null
  prior_month: AccountingPnlAnalyticsPoint | null
  prior_year_same_month: AccountingPnlAnalyticsPoint | null
}
