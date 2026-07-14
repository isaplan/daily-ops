<template>
  <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
    <div class="mb-4 flex flex-col gap-3">
      <div>
        <h2 class="text-sm font-semibold text-gray-900">Daily breakdown</h2>
        <p class="mt-0.5 text-xs text-gray-500">
          vs prev week {{ formatDelta(comparisons.previousWeek.revenue) }}
          · 3w avg {{ formatEur(comparisons.rolling3Week.avgRevenue) }}/wk
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Metrics</span>
          <button
            v-for="metric in METRIC_DEFS"
            :key="metric.key"
            type="button"
            class="rounded-full border-2 px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-opacity"
            :class="activeMetrics.has(metric.key) ? 'text-white' : 'bg-white line-through opacity-45 hover:opacity-70'"
            :style="metricPillStyle(metric.key)"
            :aria-pressed="activeMetrics.has(metric.key)"
            @click="toggleMetric(metric.key)"
          >
            {{ metric.label }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-1">
          <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Reference</span>
          <button
            v-for="opt in referenceOptions"
            :key="opt.id"
            type="button"
            class="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
            :class="activeReferences.has(opt.id)
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'"
            @click="toggleReference(opt.id)"
          >
            {{ opt.label }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-1">
          <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Bars</span>
          <button
            type="button"
            class="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
            :class="showBars
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'"
            @click="showBars = !showBars"
          >
            Hide
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-1">
          <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Averages</span>
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
        </div>
      </div>
    </div>

    <ClientOnly>
      <DailyOpsChartExpandShell
        title="Daily breakdown"
        expand-aria-label="Expand weekly daily chart"
      >
        <template #default="{ width, height }">
          <D3GroupedBarChart
            :data="chartData"
            :series="visibleSeries"
            :reference-lines="chartReferenceLines"
            :width="width"
            :height="Math.max(280, Math.round(height))"
            :show-bars="showBars"
            :normalize-series-scale="effectiveNormalizeScale"
            :always-show-bar-labels="effectiveNormalizeScale"
            :hide-y-axis="effectiveNormalizeScale"
            :format-bar-value="formatBarValue"
          />
        </template>
      </DailyOpsChartExpandShell>
    </ClientOnly>

    <p v-if="effectiveNormalizeScale" class="mt-2 text-[11px] text-gray-500">
      Mixed metrics — bar heights are relative per series; values shown above each bar.
    </p>
  </div>
</template>

<script setup lang="ts">
import D3GroupedBarChart from '~/components/charts/D3GroupedBarChart.vue'
import type { GroupedBarReferenceLine, GroupedBarSeries } from '~/components/charts/D3GroupedBarChart.vue'
import type { WeeklyCompareTrend, WeeklyDayBreakdown } from '~/types/daily-ops-weekly-report'
import type { WeeklyCompareMetric } from '~/types/daily-ops-weekly-report'
import { chartTrendSeries } from '~/utils/dailyOpsStaffChartMedians'

type MetricKey = 'revenue' | 'labor' | 'productivity' | 'staff' | 'profit'
type ReferenceId = 'avg3w' | 'avg6w' | 'prevWeek'
type AverageId = 'trend' | 'median'

type MetricDef = {
  key: MetricKey
  label: string
  color: string
  scale: 'eur' | 'count' | 'eurPerHour'
}

const METRIC_DEFS: MetricDef[] = [
  { key: 'revenue', label: 'Revenue', color: '#111827', scale: 'eur' },
  { key: 'labor', label: 'Labor', color: '#6366f1', scale: 'eur' },
  { key: 'productivity', label: 'Productivity', color: '#059669', scale: 'eurPerHour' },
  { key: 'staff', label: 'Staff', color: '#d97706', scale: 'count' },
  { key: 'profit', label: 'Profit', color: '#5B9A6F', scale: 'eur' },
]

const referenceOptions = [
  { id: 'avg3w' as const, label: '3w avg' },
  { id: 'avg6w' as const, label: '6w avg' },
  { id: 'prevWeek' as const, label: 'Prev week' },
]

const averageOptions = [
  { id: 'trend' as const, label: 'Trend' },
  { id: 'median' as const, label: 'Median' },
]

const props = defineProps<{
  dailyBreakdown: WeeklyDayBreakdown[]
  comparisons: WeeklyCompareTrend
}>()

const { formatEur } = useDashboardEurFormat()

const activeMetrics = ref<Set<MetricKey>>(new Set(METRIC_DEFS.map((m) => m.key)))
const activeReferences = ref<Set<ReferenceId>>(new Set(['avg3w']))
const activeAverages = ref<Set<AverageId>>(new Set(['trend']))
const showBars = ref(true)

function dayChartValues(row: WeeklyDayBreakdown) {
  const profit = row.pnlResult ?? row.profit ?? row.margin ?? row.revenue - row.laborCost
  const productivity =
    row.productivity ?? (row.laborHours > 0 ? row.revenue / row.laborHours : 0)
  return {
    date: row.businessDate,
    revenue: row.revenue,
    labor: row.laborCost,
    productivity,
    staff: row.staffCount ?? 0,
    profit,
  }
}

const chartData = computed(() => props.dailyBreakdown.map(dayChartValues))

const revenueRows = computed(() =>
  props.dailyBreakdown.map((row) => ({
    date: row.businessDate,
    value: row.revenue,
  })),
)

function toggleMetric(key: MetricKey) {
  const next = new Set(activeMetrics.value)
  if (next.has(key)) {
    if (next.size > 1) next.delete(key)
  } else {
    next.add(key)
  }
  activeMetrics.value = next
}

function toggleReference(id: ReferenceId) {
  const next = new Set(activeReferences.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  activeReferences.value = next
}

function toggleAverage(id: AverageId) {
  const next = new Set(activeAverages.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  activeAverages.value = next
}

function metricPillStyle(key: MetricKey) {
  const def = METRIC_DEFS.find((m) => m.key === key)!
  if (!activeMetrics.value.has(key)) {
    return { borderColor: def.color, color: def.color }
  }
  return { borderColor: def.color, backgroundColor: def.color, color: '#fff' }
}

const visibleSeries = computed((): GroupedBarSeries[] =>
  METRIC_DEFS.filter((m) => activeMetrics.value.has(m.key)).map((m) => ({
    key: m.key,
    label: m.label,
    color: m.color,
  })),
)

const usesSharedEurScale = computed(() => {
  const active = METRIC_DEFS.filter((m) => activeMetrics.value.has(m.key))
  return active.length > 0 && active.every((m) => m.scale === 'eur')
})

const useNormalizedScale = computed(() => !usesSharedEurScale.value)

/** Eur reference overlays need absolute y-scale (prev week stepped line, avgs, trend). */
const effectiveNormalizeScale = computed(() => {
  if (!useNormalizedScale.value) return false
  if (!activeMetrics.value.has('revenue')) return true
  if (activeReferences.value.has('prevWeek')) return false
  if (activeReferences.value.has('avg3w') || activeReferences.value.has('avg6w')) return false
  if (activeAverages.value.has('trend') || activeAverages.value.has('median')) return false
  return true
})

const avgDaily3Week = computed(() => {
  const days = props.dailyBreakdown.length || 7
  return Math.round((props.comparisons.rolling3Week.avgRevenue / days) * 100) / 100
})

const avgDaily6Week = computed(() => {
  const days = props.dailyBreakdown.length || 7
  return Math.round((props.comparisons.rolling6Week.avgRevenue / days) * 100) / 100
})

const weekRevenueMedian = computed(() => {
  const vals = revenueRows.value.map((r) => r.value).filter((v) => v > 0)
  if (vals.length === 0) return 0
  const sorted = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 100) / 100
    : sorted[mid]!
})

const chartReferenceLines = computed((): GroupedBarReferenceLine[] => {
  if (!activeMetrics.value.has('revenue') || effectiveNormalizeScale.value) return []
  const lines: GroupedBarReferenceLine[] = []

  if (activeReferences.value.has('avg3w')) {
    lines.push({
      id: 'avg-3w',
      label: '3w avg / day',
      kind: 'flat',
      value: avgDaily3Week.value,
      color: '#059669',
      dashArray: '6,4',
    })
  }
  if (activeReferences.value.has('avg6w')) {
    lines.push({
      id: 'avg-6w',
      label: '6w avg / day',
      kind: 'flat',
      value: avgDaily6Week.value,
      color: '#d97706',
      dashArray: '4,4',
    })
  }
  if (activeReferences.value.has('prevWeek')) {
    const points = [...props.dailyBreakdown]
      .sort((a, b) => a.businessDate.localeCompare(b.businessDate))
      .map((row) => ({ date: row.businessDate, value: row.prevWeekRevenue ?? 0 }))
    if (points.length >= 2 && points.some((p) => p.value > 0)) {
      lines.push({
        id: 'prev-week',
        label: 'Prev week',
        kind: 'series',
        points,
        color: '#9ca3af',
        dashArray: '5,5',
        curve: 'step',
      })
    }
  }

  if (activeAverages.value.has('trend')) {
    const trend = chartTrendSeries(revenueRows.value)
    if (trend.points.length >= 2) {
      lines.push({
        id: 'revenue-trend',
        label: `Trend ${trend.slopePerBucket >= 0 ? '+' : ''}${formatEur(trend.slopePerBucket)}/day`,
        kind: 'series',
        points: trend.points,
        color: '#374151',
        dashArray: '8,4',
      })
    }
  }

  if (activeAverages.value.has('median') && weekRevenueMedian.value > 0) {
    lines.push({
      id: 'revenue-median',
      label: `Median ${formatEur(weekRevenueMedian.value)}`,
      kind: 'flat',
      value: weekRevenueMedian.value,
      color: '#6b7280',
      dashArray: '2,3',
    })
  }

  return lines
})

function formatBarValue(value: number, seriesKey: string): string {
  const def = METRIC_DEFS.find((m) => m.key === seriesKey)
  if (!def) return String(Math.round(value))
  if (def.scale === 'count') return String(Math.round(value))
  if (def.scale === 'eurPerHour') return `${Math.round(value)} €/h`
  if (Math.abs(value) >= 1000) return `€${Math.round(value / 1000)}k`
  return formatEur(value)
}

function formatDelta(metric: WeeklyCompareMetric): string {
  const sign = metric.delta >= 0 ? '+' : ''
  const pctPart = metric.pct != null ? ` (${sign}${metric.pct}%)` : ''
  return `${sign}${formatEur(metric.delta)}${pctPart}`
}
</script>
