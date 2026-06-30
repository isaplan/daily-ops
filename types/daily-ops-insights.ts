/**
 * @registry-id: dailyOpsInsightsTypes
 * @created: 2026-06-25T20:00:00.000Z
 * @last-modified: 2026-06-30T20:00:00.000Z
 * @description: Types for Daily Ops performance insights (month/year only)
 * @last-fix: [2026-06-30] Plain verdict + compare rows; monthly/yearly mode
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsInsights/buildPerformanceInsights.ts
 * ✓ server/api/daily-ops/insights.get.ts
 * ✓ components/daily-ops/insights/DailyOpsPerformanceInsights.vue
 */

import type { InsightsNavMode } from '~/utils/dailyOpsInsightsNav/modes'

export type DailyOpsInsightsRangeDto = {
  key: string
  startDate: string
  endDate: string
  label: string
}

export type DailyOpsInsightsMetricBlock = {
  revenue: number
  cogs: number
  labor: number
  fixed_overhead: number
  gross_profit: number
  net_profit: number
  gewerkt_hours: number
  staff_count: number
  labor_pct_revenue: number | null
  revenue_per_hour: number | null
  loaded_eur_per_hour: number | null
}

export type DailyOpsInsightsDelta = {
  revenue_pct: number | null
  labor_pct: number | null
  hours_pct: number | null
  staff_pct: number | null
  labor_pct_revenue_pp: number | null
  revenue_per_hour_pct: number | null
}

export type DailyOpsInsightsVerdict = {
  headline: string
  bullets: string[]
}

export type DailyOpsInsightsCompareRow = {
  id: string
  label: string
  current: string
  prior: string
  change: string
  direction: 'up' | 'down' | 'flat' | 'unknown'
  good: boolean | null
}

export type DailyOpsInsightsTrendPoint = {
  date: string
  label: string
  revenue: number
  labor: number
  cogs: number
  net_profit: number
  gewerkt_hours: number
  labor_pct_revenue: number | null
  cogs_pct_revenue: number | null
  net_pct_revenue: number | null
  revenue_per_hour: number | null
}

export type DailyOpsPerformanceInsightsDto = {
  mode: InsightsNavMode
  slot: string
  range: DailyOpsInsightsRangeDto
  prior_range: DailyOpsInsightsRangeDto | null
  compare_label: string
  current: DailyOpsInsightsMetricBlock
  prior: DailyOpsInsightsMetricBlock | null
  delta: DailyOpsInsightsDelta | null
  verdict: DailyOpsInsightsVerdict
  compare_rows: DailyOpsInsightsCompareRow[]
  trend: DailyOpsInsightsTrendPoint[]
  trend_label: string
  assumptions_note: string
  data_gap: boolean
}
