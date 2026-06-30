<template>
  <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-gray-900">
        {{ trendLabel }}
      </h2>

      <div
        v-if="trend.length"
        class="inline-flex shrink-0 items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-0.5"
        role="group"
        aria-label="Trend display mode"
      >
        <button
          type="button"
          class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="viewMode === 'chart' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
          :aria-pressed="viewMode === 'chart'"
          title="Graph"
          @click="viewMode = 'chart'"
        >
          <UIcon name="i-lucide-chart-column-stacked" class="size-4" aria-hidden="true" />
          <span class="sr-only">Graph</span>
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="viewMode === 'table' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
          :aria-pressed="viewMode === 'table'"
          title="Table"
          @click="viewMode = 'table'"
        >
          <UIcon name="i-lucide-sheet" class="size-4" aria-hidden="true" />
          <span class="sr-only">Table</span>
        </button>
      </div>
    </div>

    <div v-if="!trend.length" class="text-sm text-gray-600">
      No trend data for this range.
    </div>

    <template v-else>
      <div v-if="viewMode === 'chart'" class="mb-4 flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-1">
          <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Metric</span>
          <button
            v-for="m in metricOptions"
            :key="m.id"
            type="button"
            class="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
            :class="activeMetric === m.id
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'"
            @click="activeMetric = m.id"
          >
            {{ m.label }}
          </button>
        </div>

        <InsightsBenchmarkPills
          :model-value="benchmarkId"
          :metric-supports-benchmark="showBenchmarkLine"
          :unsupported-metric-label="metricMeta(activeMetric).label"
          @update:model-value="onBenchmarkIdUpdate"
        />

        <div class="flex flex-wrap items-center gap-1">
          <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Overlay</span>
          <button
            v-for="opt in averageOptions"
            :key="opt.id"
            type="button"
            class="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
            :class="activeAverages.has(opt.id)
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'"
            @click="toggleAverage(opt.id)"
          >
            {{ opt.label }}
          </button>
          <div v-if="activeAverages.has('rolling')" class="ml-1 flex flex-wrap items-center gap-1">
            <button
              v-for="w in rollingWindowLabels"
              :key="w"
              type="button"
              class="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
              :class="activeRolling.has(w)
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'"
              @click="toggleRolling(w)"
            >
              {{ w }}
            </button>
          </div>
        </div>
      </div>

      <DailyOpsChartExpandShell
        v-if="viewMode === 'chart'"
        :title="chartTitle"
        expand-aria-label="Expand insights trend chart"
        :default-width="760"
        :default-height="320"
      >
        <template #default="{ width, height }">
          <D3GroupedBarChart
            :data="barChartData"
            :series="barChartSeries"
            :reference-lines="chartReferenceLines"
            :date-granularity="chartGranularity"
            :format-bar-value="formatBarValue"
            :width="width"
            :height="Math.max(280, Math.round(height))"
          />
        </template>
      </DailyOpsChartExpandShell>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-xs">
          <thead>
            <tr class="border-b border-gray-200 text-gray-500">
              <th class="py-2 pr-4 font-medium">
                {{ mode === 'yearly' ? 'Year' : 'Month' }}
              </th>
              <th
                v-for="col in tableColumns"
                :key="col.id"
                class="py-2 pr-4 font-medium text-right"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in trend"
              :key="row.date"
              class="border-b border-gray-100 tabular-nums"
              :class="row.date === highlightKey ? 'bg-gray-50 font-semibold' : ''"
            >
              <td class="py-2 pr-4">
                {{ row.label }}
              </td>
              <td
                v-for="col in tableColumns"
                :key="`${row.date}-${col.id}`"
                class="py-2 pr-4 text-right"
              >
                {{ col.format(row) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="viewMode === 'chart' && chartLegendText" class="mt-2 text-xs leading-snug text-gray-500">
        {{ chartLegendText }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import D3GroupedBarChart from '~/components/charts/D3GroupedBarChart.vue'
import InsightsBenchmarkPills from '~/components/daily-ops/insights/InsightsBenchmarkPills.vue'
import type { GroupedBarDataPoint, GroupedBarReferenceLine, GroupedBarSeries } from '~/components/charts/D3GroupedBarChart.vue'
import type { DailyOpsInsightsTrendPoint } from '~/types/daily-ops-insights'
import type { InsightsNavMode } from '~/utils/dailyOpsInsightsNav/modes'
import type { StaffChartGranularity } from '~/utils/dailyOpsStaffNav/modes'
import { formatDashboardEur } from '~/utils/dashboardEurFormat'
import { referenceLineColor, referenceLineStyleForAverage } from '~/utils/chartReferenceColor'
import {
  STAFF_ROLLING_WINDOW_DAYS,
  chartPeriodMedian,
  chartRollingMedianSeries,
  chartTrendSeries,
} from '~/utils/dailyOpsStaffChartMedians'
import {
  INSIGHTS_CHART_METRICS,
  benchmarkReferenceLinesForMetric,
  chartMetricHasBenchmark,
  chartMetricValue,
  type InsightsChartMetricId,
} from '~/utils/dailyOpsInsightsNav/chartMetrics'
import type { InsightsBenchmarkId } from '~/utils/dailyOpsInsightsNav/benchmarks'
import { insightsBenchmarkById } from '~/utils/dailyOpsInsightsNav/benchmarks'

type LocationRow = { _id: string; chartColor?: string }

const props = defineProps<{
  trend: DailyOpsInsightsTrendPoint[]
  mode: InsightsNavMode
  trendLabel: string
  highlightKey?: string
  locationId?: string | null
  benchmarkId: InsightsBenchmarkId
}>()

const emit = defineEmits<{
  'update:benchmarkId': [id: InsightsBenchmarkId]
}>()

const activeBenchmark = computed(() => insightsBenchmarkById(props.benchmarkId))

const BAR_KEY = 'value'

const FALLBACK_VENUE_COLORS: Record<string, string> = {
  '69d6cfa63d2adf93b79d1ae7': '#2563eb',
  '69d6cfa63d2adf93b79d1ae6': '#059669',
  '69d6cfa73d2adf93b79d1ae8': '#d97706',
}

const rollingWindowLabels = ['30d', '60d', '90d'] as const

const metricOptions = INSIGHTS_CHART_METRICS

const averageOptions = [
  { id: 'trend' as const, label: 'Trend' },
  { id: 'median' as const, label: 'Median' },
  { id: 'rolling' as const, label: 'Rolling' },
]

const viewMode = ref<'chart' | 'table'>('chart')
const activeMetric = ref<InsightsChartMetricId>('labor_pct')
const activeAverages = ref(new Set<'trend' | 'median' | 'rolling'>(['trend', 'median']))
const activeRolling = ref(new Set<string>(['90d']))

const { data: locationsRes } = useFetch<{ success: boolean; data: LocationRow[] }>('/api/locations')

const chartGranularity = computed((): StaffChartGranularity =>
  props.mode === 'yearly' ? 'year' : 'month',
)

const barColor = computed(() => {
  if (!props.locationId) return '#374151'
  const fromApi = locationsRes.value?.data?.find((l) => l._id === props.locationId)?.chartColor
  return fromApi ?? FALLBACK_VENUE_COLORS[props.locationId] ?? '#374151'
})

const tableColumns = [
  { id: 'revenue', label: 'Revenue', format: (r: DailyOpsInsightsTrendPoint) => formatDashboardEur(r.revenue) },
  { id: 'labor', label: 'Staff costs', format: (r: DailyOpsInsightsTrendPoint) => formatDashboardEur(r.labor) },
  { id: 'cogs', label: 'COGS (est.)', format: (r: DailyOpsInsightsTrendPoint) => formatDashboardEur(r.cogs) },
  { id: 'net', label: 'Net (est.)', format: (r: DailyOpsInsightsTrendPoint) => formatDashboardEur(r.net_profit) },
  { id: 'hours', label: 'Hours', format: (r: DailyOpsInsightsTrendPoint) => `${r.gewerkt_hours.toFixed(0)}h` },
  {
    id: 'labor_pct',
    label: 'Staff %',
    format: (r: DailyOpsInsightsTrendPoint) =>
      r.labor_pct_revenue != null ? `${r.labor_pct_revenue.toFixed(0)}%` : '—',
  },
  {
    id: 'cogs_pct',
    label: 'COGS %',
    format: (r: DailyOpsInsightsTrendPoint) =>
      r.cogs_pct_revenue != null ? `${r.cogs_pct_revenue.toFixed(0)}%` : '—',
  },
  {
    id: 'net_pct',
    label: 'Net %',
    format: (r: DailyOpsInsightsTrendPoint) =>
      r.net_pct_revenue != null ? `${r.net_pct_revenue.toFixed(0)}%` : '—',
  },
  {
    id: 'rev_h',
    label: '€/hour',
    format: (r: DailyOpsInsightsTrendPoint) =>
      r.revenue_per_hour != null ? `€${r.revenue_per_hour.toFixed(0)}` : '—',
  },
]

function metricValue(row: DailyOpsInsightsTrendPoint, metric: InsightsChartMetricId): number {
  return chartMetricValue(row, metric)
}

function metricMeta(metric: InsightsChartMetricId) {
  const opt = metricOptions.find((m) => m.id === metric)!
  const isEuro = metric === 'revenue' || metric === 'labor' || metric === 'cogs' || metric === 'net' || metric === 'rev_h'
  const isPct = metric === 'labor_pct' || metric === 'cogs_pct' || metric === 'net_pct'
  const suffix = metric === 'hours' ? 'h' : isPct ? '%' : ''
  const decimals = metric === 'hours' ? 0 : isPct ? 1 : 0
  return { label: opt.label, isEuro, isPct, suffix, decimals }
}

function formatMetricValue(n: number, metric: InsightsChartMetricId): string {
  const { isEuro, isPct, suffix, decimals } = metricMeta(metric)
  if (isEuro) return formatDashboardEur(n)
  if (isPct) return `${n.toFixed(decimals)}%`
  return `${n.toFixed(decimals)}${suffix}`
}

function formatBarValue(n: number) {
  return formatMetricValue(n, activeMetric.value)
}

const metricSeries = computed(() =>
  props.trend.map((row) => ({
    date: row.date,
    value: metricValue(row, activeMetric.value),
  })),
)

const showBenchmarkLine = computed(
  () => !!activeBenchmark.value && chartMetricHasBenchmark(activeMetric.value),
)

const barChartData = computed((): GroupedBarDataPoint[] =>
  metricSeries.value.map((row) => ({
    date: row.date,
    [BAR_KEY]: row.value,
  })),
)

const barChartSeries = computed((): GroupedBarSeries[] => [{
  key: BAR_KEY,
  label: metricMeta(activeMetric.value).label,
  color: barColor.value,
}])

const chartTitle = computed(() => {
  const unit = props.mode === 'yearly' ? 'year' : 'month'
  return `${metricMeta(activeMetric.value).label} per ${unit}`
})

function toggleAverage(id: 'trend' | 'median' | 'rolling') {
  const next = new Set(activeAverages.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  activeAverages.value = next
}

function toggleRolling(w: string) {
  const next = new Set(activeRolling.value)
  if (next.has(w)) next.delete(w)
  else next.add(w)
  activeRolling.value = next
}

function onBenchmarkIdUpdate(id: InsightsBenchmarkId) {
  emit('update:benchmarkId', id)
  if (!chartMetricHasBenchmark(activeMetric.value)) {
    activeMetric.value = 'labor_pct'
  }
}

const chartReferenceLines = computed((): GroupedBarReferenceLine[] => {
  const data = metricSeries.value.filter((p) => p.value > 0)
  const lines: GroupedBarReferenceLine[] = []

  if (showBenchmarkLine.value && activeBenchmark.value) {
    lines.push(
      ...benchmarkReferenceLinesForMetric(
        activeMetric.value,
        props.trend,
        activeBenchmark.value,
        formatMetricValue,
      ),
    )
  }

  if (!data.length || !activeAverages.value.size) return lines

  const metric = activeMetric.value
  const { isEuro, suffix, decimals } = metricMeta(metric)
  const unit = props.mode === 'yearly' ? 'year' : 'month'
  const formatTotal = (n: number) => formatMetricValue(n, metric)

  if (activeAverages.value.has('trend')) {
    const trend = chartTrendSeries(data)
    if (trend.points.length >= 2) {
      const slopeLabel = isEuro
        ? `${trend.slopePerBucket >= 0 ? '+' : ''}${formatDashboardEur(trend.slopePerBucket)}/${unit}`
        : `${trend.slopePerBucket >= 0 ? '+' : ''}${trend.slopePerBucket.toFixed(decimals)}${suffix}/${unit}`
      const style = referenceLineStyleForAverage('trend')
      lines.push({
        id: 'insights-trend',
        kind: 'series',
        points: trend.points,
        label: `${slopeLabel} · n=${trend.sampleCount}`,
        color: referenceLineColor(barColor.value, 'trend'),
        strokeWidth: style.strokeWidth,
        dashArray: style.dashArray,
        strokeLinecap: 'strokeLinecap' in style ? style.strokeLinecap : undefined,
      })
    }
  }

  if (activeAverages.value.has('median')) {
    const stat = chartPeriodMedian(data)
    if (stat.median > 0) {
      const style = referenceLineStyleForAverage('median')
      lines.push({
        id: 'insights-median',
        kind: 'flat',
        value: stat.median,
        label: `Median ${formatTotal(stat.median)} · n=${stat.sampleCount}`,
        color: referenceLineColor(barColor.value, 'median'),
        strokeWidth: style.strokeWidth,
        dashArray: style.dashArray,
      })
    }
  }

  if (activeAverages.value.has('rolling')) {
    for (const windowLabel of rollingWindowLabels) {
      if (!activeRolling.value.has(windowLabel)) continue
      const days = STAFF_ROLLING_WINDOW_DAYS[windowLabel]!
      const points = chartRollingMedianSeries(data, chartGranularity.value, days)
      const last = [...points].reverse().find((p) => p.value > 0)
      if (!last) continue
      const style = referenceLineStyleForAverage('rolling')
      lines.push({
        id: `insights-${windowLabel}`,
        kind: 'series',
        points,
        label: `${windowLabel} ${formatTotal(last.value)}`,
        color: referenceLineColor(barColor.value, 'rolling'),
        strokeWidth: style.strokeWidth,
        dashArray: style.dashArray,
        strokeLinecap: 'strokeLinecap' in style ? style.strokeLinecap : undefined,
      })
    }
  }

  return lines
})

const chartLegendText = computed(() => {
  if (viewMode.value !== 'chart') return ''
  const parts: string[] = [`Bars: ${metricMeta(activeMetric.value).label}`]
  if (showBenchmarkLine.value && activeBenchmark.value) {
    parts.push(`Amber line: ${activeBenchmark.value.shortLabel}`)
  }
  if (activeAverages.value.has('trend')) parts.push('Solid trend')
  if (activeAverages.value.has('median')) parts.push('Dashed median')
  if (activeAverages.value.has('rolling')) {
    const rolling = [...activeRolling.value].sort().join(', ') || '90d'
    parts.push(`Dotted rolling ${rolling}`)
  }
  return parts.join(' · ')
})
</script>
