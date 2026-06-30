/**
 * @registry-id: dailyOpsInsightsChartMetrics
 * @created: 2026-06-30T23:00:00.000Z
 * @last-modified: 2026-06-30T23:00:00.000Z
 * @description: Insights trend chart metric ids + benchmark reference lines
 * @last-fix: [2026-06-25] Amber benchmark line on actual bars
 *
 * @exports-to:
 * ✓ components/daily-ops/insights/InsightsTrendSection.vue
 */

import type { GroupedBarReferenceLine } from '~/components/charts/D3GroupedBarChart.vue'
import type { DailyOpsInsightsTrendPoint } from '~/types/daily-ops-insights'
import type { InsightsBenchmarkProfile } from '~/utils/dailyOpsInsightsNav/benchmarks'

export const INSIGHTS_BENCHMARK_COLOR = '#b45309'

export type InsightsChartMetricId =
  | 'revenue'
  | 'labor'
  | 'cogs'
  | 'net'
  | 'labor_pct'
  | 'cogs_pct'
  | 'net_pct'
  | 'hours'
  | 'rev_h'

export const INSIGHTS_CHART_METRICS: Array<{ id: InsightsChartMetricId; label: string }> = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'labor', label: 'Staff costs' },
  { id: 'cogs', label: 'COGS (est.)' },
  { id: 'net', label: 'Net (est.)' },
  { id: 'labor_pct', label: 'Staff %' },
  { id: 'cogs_pct', label: 'COGS %' },
  { id: 'net_pct', label: 'Net %' },
  { id: 'hours', label: 'Hours' },
  { id: 'rev_h', label: '€/hour' },
]

export function chartMetricValue(row: DailyOpsInsightsTrendPoint, metric: InsightsChartMetricId): number {
  switch (metric) {
    case 'revenue': return row.revenue
    case 'labor': return row.labor
    case 'cogs': return row.cogs
    case 'net': return row.net_profit
    case 'labor_pct': return row.labor_pct_revenue ?? 0
    case 'cogs_pct': return row.cogs_pct_revenue ?? 0
    case 'net_pct': return row.net_pct_revenue ?? 0
    case 'hours': return row.gewerkt_hours
    case 'rev_h': return row.revenue_per_hour ?? 0
  }
}

export function chartMetricHasBenchmark(metric: InsightsChartMetricId): boolean {
  return metric !== 'revenue' && metric !== 'hours' && metric !== 'rev_h'
}

function euroAtPct(revenue: number, pct: number): number {
  return Math.round(revenue * (pct / 100))
}

export function benchmarkReferenceLinesForMetric(
  metric: InsightsChartMetricId,
  trend: DailyOpsInsightsTrendPoint[],
  benchmark: InsightsBenchmarkProfile,
  formatValue: (n: number, metric: InsightsChartMetricId) => string,
): GroupedBarReferenceLine[] {
  if (!chartMetricHasBenchmark(metric)) return []

  const tag = benchmark.shortLabel
  const color = INSIGHTS_BENCHMARK_COLOR

  if (metric === 'labor_pct') {
    return [{
      id: 'benchmark-labor-pct',
      kind: 'flat',
      value: benchmark.labor_pct,
      label: `${tag} ${benchmark.labor_pct}%`,
      color,
      strokeWidth: 2.5,
    }]
  }
  if (metric === 'cogs_pct') {
    return [{
      id: 'benchmark-cogs-pct',
      kind: 'flat',
      value: benchmark.cogs_pct,
      label: `${tag} ${benchmark.cogs_pct}%`,
      color,
      strokeWidth: 2.5,
    }]
  }
  if (metric === 'net_pct') {
    return [{
      id: 'benchmark-net-pct',
      kind: 'flat',
      value: benchmark.net_pct,
      label: `${tag} ${benchmark.net_pct}%`,
      color,
      strokeWidth: 2.5,
    }]
  }

  const pctKey =
    metric === 'labor' ? benchmark.labor_pct
      : metric === 'cogs' ? benchmark.cogs_pct
        : benchmark.net_pct

  const points = trend
    .filter((r) => r.revenue > 0)
    .map((r) => ({
      date: r.date,
      value: euroAtPct(r.revenue, pctKey),
    }))

  if (!points.length) return []

  return [{
    id: `benchmark-${metric}-eur`,
    kind: 'series',
    points,
    label: `${tag} ${formatValue(points[points.length - 1]!.value, metric)} (${pctKey}%)`,
    color,
    strokeWidth: 2.5,
    dashArray: '6,4',
  }]
}
