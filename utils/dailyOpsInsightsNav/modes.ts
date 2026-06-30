/**
 * @registry-id: dailyOpsInsightsNavModes
 * @created: 2026-06-30T20:00:00.000Z
 * @last-modified: 2026-06-30T20:00:00.000Z
 * @description: Insights nav — monthly / yearly only (no daily)
 * @last-fix: [2026-06-30] Month-on-month and year-on-year slots
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsInsights/parseInsightsQuery.ts
 * ✓ components/daily-ops/insights/InsightsAnalyticsNav.vue
 * ✓ composables/useDailyOpsInsightsMetrics.ts
 */

import { DEFAULT_INSIGHTS_BENCHMARK_ID } from '~/utils/dailyOpsInsightsNav/benchmarks'

export const INSIGHTS_NAV_MODES = ['monthly', 'yearly'] as const
export type InsightsNavMode = (typeof INSIGHTS_NAV_MODES)[number]

const MODE_SET = new Set<string>(INSIGHTS_NAV_MODES)

export function isInsightsNavMode(mode: string): mode is InsightsNavMode {
  return MODE_SET.has(mode)
}

export function coerceInsightsNavMode(mode: string): InsightsNavMode {
  return isInsightsNavMode(mode) ? mode : 'monthly'
}

export function defaultInsightsQuery(anchor: string): Record<string, string> {
  return { mode: 'monthly', slot: 'last-month', anchor, benchmark: DEFAULT_INSIGHTS_BENCHMARK_ID }
}

export const INSIGHTS_NAV_MODE_CONFIGS: Array<{ id: InsightsNavMode; label: string; defaultSlot: string }> = [
  { id: 'monthly', label: 'Monthly', defaultSlot: 'last-month' },
  { id: 'yearly', label: 'Yearly', defaultSlot: 'last-year' },
]
