<template>
  <div
    ref="rootEl"
    class="rounded-lg border-2 border-gray-900 bg-white p-4"
  >
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-gray-900">
        {{ title }}
      </h2>
      <div
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

    <div v-if="!series.length" class="text-sm text-gray-600">
      No sealed monthly P&L to chart.
    </div>

    <template v-else>
      <div v-if="viewMode === 'chart'" class="mb-4 flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Metrics</span>
          <button
            v-for="m in METRIC_DEFS"
            :key="m.key"
            type="button"
            class="rounded-full border-2 px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-opacity"
            :class="activeMetrics.has(m.key)
              ? 'text-white'
              : 'bg-white line-through opacity-45 hover:opacity-70'"
            :style="metricPillStyle(m.key)"
            :aria-pressed="activeMetrics.has(m.key)"
            @click="toggleMetric(m.key)"
          >
            {{ m.label }}{{ opsPending && needsOps(m.key) ? '…' : '' }}
          </button>
        </div>

        <div
          v-if="showOpsStacked"
          class="flex flex-wrap items-center gap-1"
        >
          <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Contract</span>
          <button
            v-for="c in contractOptions"
            :key="c.id"
            type="button"
            class="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
            :class="activeContracts.has(c.id)
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'"
            @click="toggleContract(c.id)"
          >
            {{ c.label }}
          </button>
        </div>

        <div
          v-if="showAverageControls"
          class="flex flex-wrap items-center gap-1"
        >
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
        expand-aria-label="Expand P&L analytics chart"
        :default-width="900"
        :default-height="360"
      >
        <template #default="{ width, height }">
          <D3StackedBarChart
            v-if="showOpsStacked && stackedChartData.length && visibleContractKeys.length && !opsPending"
            :data="stackedChartData"
            :keys="visibleContractKeys"
            :key-labels="contractKeyLabels"
            :colors="visibleContractColors"
            date-granularity="month"
            :width="width"
            :height="Math.max(280, Math.round(height))"
            :show-value-labels="true"
            :show-stack-totals="true"
            :format-segment-value="formatOpsSegment"
            :format-stack-total="formatOpsTotal"
          />
          <p
            v-else-if="showOpsStacked && opsPending"
            class="py-12 text-center text-sm text-gray-500"
          >
            Loading {{ soleOpsMetric === 'hours' ? 'hours' : 'active staff' }}…
          </p>
          <D3GroupedBarChart
            v-else-if="barChartData.length && visibleSeries.length"
            :key="`pnl-${visibleSeries.map((s) => s.key).join(',')}`"
            :data="barChartData"
            :series="visibleSeries"
            :reference-lines="chartReferenceLines"
            date-granularity="month"
            :format-bar-value="formatBarValue"
            :normalize-series-scale="effectiveNormalizeScale"
            :always-show-bar-labels="effectiveNormalizeScale"
            :hide-y-axis="effectiveNormalizeScale"
            :width="width"
            :height="Math.max(280, Math.round(height))"
          />
          <p
            v-else
            class="py-12 text-center text-sm text-gray-500"
          >
            No data for this selection.
          </p>
        </template>
      </DailyOpsChartExpandShell>

      <p
        v-if="viewMode === 'chart' && showOpsStacked"
        class="mt-2 text-[11px] text-gray-500"
      >
        {{ soleOpsMetric === 'hours'
          ? 'Hours = gewerkt, stacked by contract (FT / PT / ZZP).'
          : 'Staff = unique active workers per month, stacked by contract.' }}
      </p>
      <p
        v-else-if="viewMode === 'chart' && effectiveNormalizeScale"
        class="mt-2 text-[11px] text-gray-500"
      >
        Mixed metrics — bar heights are relative per series; values shown above each bar.
      </p>

      <div v-else-if="viewMode === 'table'" class="overflow-x-auto">
        <table class="min-w-full text-left text-xs">
          <thead>
            <tr class="border-b border-gray-200 text-gray-500">
              <th class="py-2 pr-4 font-medium">Month</th>
              <th
                v-for="col in activeTableColumns"
                :key="col.id"
                class="py-2 pr-4 font-medium text-right"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in tableRows"
              :key="row.date"
              class="border-b border-gray-100 tabular-nums"
            >
              <td class="py-2 pr-4">{{ row.label }}</td>
              <td
                v-for="col in activeTableColumns"
                :key="`${row.date}-${col.id}`"
                class="py-2 pr-4 text-right"
              >
                {{ col.format(row) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: PnlAnalyticsTrendChart
 * @created: 2026-08-11T12:55:00.000Z
 * @last-modified: 2026-08-11T14:55:00.000Z
 * @description: Full sealed-P&L history chart — multi-metric side-by-side + stacked staff/hours
 * @last-fix: [2026-08-11] Multi-select metrics side-by-side (normalize mixed scales)
 * @adr-ref: ADR-022, ADR-004
 */
import D3GroupedBarChart from '~/components/charts/D3GroupedBarChart.vue'
import D3StackedBarChart from '~/components/charts/D3StackedBarChart.vue'
import type {
  GroupedBarDataPoint,
  GroupedBarReferenceLine,
  GroupedBarSeries,
} from '~/components/charts/D3GroupedBarChart.vue'
import type { StackedBarDataPoint } from '~/components/charts/D3StackedBarChart.vue'
import type {
  AccountingPnlAnalyticsPoint,
  AccountingPnlAnalyticsStaffPoint,
} from '~/types/accounting-pnl-analytics'
import { formatAccountingPnlCompact } from '~/utils/accountingPnlFormat'
import { referenceLineColor, referenceLineStyleForAverage } from '~/utils/chartReferenceColor'
import {
  chartPeriodMedian,
  chartRollingMedianSeries,
  chartTrendSeries,
} from '~/utils/dailyOpsStaffChartMedians'

type MetricKey =
  | 'revenue' | 'labor' | 'cogs' | 'fixed' | 'result'
  | 'labor_pct' | 'cogs_pct' | 'result_pct'
  | 'staff' | 'hours'

type MetricScale = 'eur' | 'percent' | 'count' | 'hours'
type ContractKey = 'ft' | 'pt' | 'zzp'

type MetricDef = {
  key: MetricKey
  label: string
  color: string
  scale: MetricScale
}

type TableRow = AccountingPnlAnalyticsPoint & {
  staff_count?: number
  ft?: number
  pt?: number
  zzp?: number
  hours?: number
  hours_ft?: number
  hours_pt?: number
  hours_zzp?: number
}

const METRIC_DEFS: MetricDef[] = [
  { key: 'revenue', label: 'Revenue', color: '#111827', scale: 'eur' },
  { key: 'labor', label: 'Staff costs', color: '#6366f1', scale: 'eur' },
  { key: 'cogs', label: 'COGS', color: '#dc2626', scale: 'eur' },
  { key: 'fixed', label: 'Fixed', color: '#7c3aed', scale: 'eur' },
  { key: 'result', label: 'Net', color: '#5B9A6F', scale: 'eur' },
  { key: 'labor_pct', label: 'Staff %', color: '#4338ca', scale: 'percent' },
  { key: 'cogs_pct', label: 'COGS %', color: '#b91c1c', scale: 'percent' },
  { key: 'result_pct', label: 'Net %', color: '#3f6212', scale: 'percent' },
  { key: 'staff', label: 'Staff', color: '#d97706', scale: 'count' },
  { key: 'hours', label: 'Hours', color: '#0f766e', scale: 'hours' },
]

const props = defineProps<{
  series: AccountingPnlAnalyticsPoint[]
  staffSeries?: AccountingPnlAnalyticsStaffPoint[]
  venue?: string
  title: string
}>()

const rootEl = ref<HTMLElement | null>(null)
const viewMode = ref<'chart' | 'table'>('chart')
const activeMetrics = ref(new Set<MetricKey>(['revenue']))
const activeAverages = ref(new Set<'trend' | 'median' | 'rolling'>(['trend', 'median']))
const activeRolling = ref(new Set<string>(['12m']))
const activeContracts = ref(new Set<ContractKey>(['ft', 'pt', 'zzp']))
const rollingWindowLabels = ['3m', '6m', '12m'] as const
const ROLLING_DAYS: Record<string, number> = { '3m': 90, '6m': 180, '12m': 365 }

const staffQuery = computed(() => ({ venue: props.venue ?? 'combined' }))
const {
  data: opsPayload,
  pending: opsPending,
  execute: loadOps,
  clear: clearOps,
} = useFetch<{ staff_series: AccountingPnlAnalyticsStaffPoint[] }>(
  '/api/daily-ops/finance/analytics/staff',
  {
    query: staffQuery,
    immediate: false,
    watch: [staffQuery],
  },
)

function needsOps (key: MetricKey): boolean {
  return key === 'staff' || key === 'hours'
}

const soleOpsMetric = computed((): 'staff' | 'hours' | null => {
  if (activeMetrics.value.size !== 1) return null
  const only = [...activeMetrics.value][0]
  return only === 'staff' || only === 'hours' ? only : null
})

const showOpsStacked = computed(() => soleOpsMetric.value != null)

const activeMetricList = computed(() =>
  METRIC_DEFS.filter((m) => activeMetrics.value.has(m.key)),
)

const usesSharedEurScale = computed(() => {
  const active = activeMetricList.value
  return active.length > 0 && active.every((m) => m.scale === 'eur')
})

const effectiveNormalizeScale = computed(
  () => !showOpsStacked.value && !usesSharedEurScale.value && activeMetrics.value.size > 0,
)

const showAverageControls = computed(
  () => !showOpsStacked.value && activeMetrics.value.size === 1 && !effectiveNormalizeScale.value,
)

const opsSeries = computed(
  () => opsPayload.value?.staff_series ?? props.staffSeries ?? [],
)

watch(
  activeMetrics,
  (metrics) => {
    if ((metrics.has('staff') || metrics.has('hours')) && !opsPayload.value && !opsPending.value) {
      void loadOps()
    }
  },
  { deep: true },
)

watch(
  () => props.venue,
  () => {
    clearOps()
    if (activeMetrics.value.has('staff') || activeMetrics.value.has('hours')) void loadOps()
  },
)

const contractOptions: Array<{ id: ContractKey; label: string; color: string }> = [
  { id: 'ft', label: "FT'er", color: '#1d4ed8' },
  { id: 'pt', label: "PT'er", color: '#059669' },
  { id: 'zzp', label: 'ZZP', color: '#d97706' },
]

const averageOptions = [
  { id: 'trend' as const, label: 'Trend' },
  { id: 'median' as const, label: 'Median' },
  { id: 'rolling' as const, label: 'Rolling' },
]

const pnlTableColumns = [
  { id: 'revenue', label: 'Revenue', format: (r: TableRow) => formatAccountingPnlCompact(r.revenue) },
  { id: 'labor', label: 'Staff €', format: (r: TableRow) => formatAccountingPnlCompact(r.labor) },
  { id: 'cogs', label: 'COGS', format: (r: TableRow) => formatAccountingPnlCompact(r.cogs) },
  { id: 'fixed', label: 'Fixed', format: (r: TableRow) => formatAccountingPnlCompact(r.fixed) },
  { id: 'result', label: 'Net', format: (r: TableRow) => formatAccountingPnlCompact(r.result) },
  {
    id: 'labor_pct',
    label: 'Staff %',
    format: (r: TableRow) => (r.labor_pct != null ? `${r.labor_pct.toFixed(0)}%` : '—'),
  },
  { id: 'staff_count', label: 'Active', format: (r: TableRow) => String(r.staff_count ?? 0) },
  { id: 'hours', label: 'Hours', format: (r: TableRow) => `${Math.round(r.hours ?? 0)}h` },
]

const staffTableColumns = [
  { id: 'staff_count', label: 'Active', format: (r: TableRow) => String(r.staff_count ?? 0) },
  { id: 'ft', label: "FT'er", format: (r: TableRow) => String(r.ft ?? 0) },
  { id: 'pt', label: "PT'er", format: (r: TableRow) => String(r.pt ?? 0) },
  { id: 'zzp', label: 'ZZP', format: (r: TableRow) => String(r.zzp ?? 0) },
]

const hoursTableColumns = [
  { id: 'hours', label: 'Hours', format: (r: TableRow) => `${Math.round(r.hours ?? 0)}h` },
  { id: 'hours_ft', label: "FT'er", format: (r: TableRow) => `${Math.round(r.hours_ft ?? 0)}h` },
  { id: 'hours_pt', label: "PT'er", format: (r: TableRow) => `${Math.round(r.hours_pt ?? 0)}h` },
  { id: 'hours_zzp', label: 'ZZP', format: (r: TableRow) => `${Math.round(r.hours_zzp ?? 0)}h` },
]

const activeTableColumns = computed(() => {
  if (soleOpsMetric.value === 'staff') return staffTableColumns
  if (soleOpsMetric.value === 'hours') return hoursTableColumns
  return pnlTableColumns
})

const tableRows = computed((): TableRow[] => {
  const byDate = new Map(opsSeries.value.map((s) => [s.date, s]))
  return props.series.map((row) => {
    const staff = byDate.get(row.date)
    return {
      ...row,
      staff_count: staff?.staff_count ?? 0,
      ft: staff?.ft ?? 0,
      pt: staff?.pt ?? 0,
      zzp: staff?.zzp ?? 0,
      hours: staff?.hours ?? 0,
      hours_ft: staff?.hours_ft ?? 0,
      hours_pt: staff?.hours_pt ?? 0,
      hours_zzp: staff?.hours_zzp ?? 0,
    }
  })
})

function metricDef (key: MetricKey): MetricDef {
  return METRIC_DEFS.find((m) => m.key === key)!
}

function metricPillStyle (key: MetricKey) {
  const def = metricDef(key)
  if (!activeMetrics.value.has(key)) {
    return { borderColor: def.color, color: def.color }
  }
  return { borderColor: def.color, backgroundColor: def.color, color: '#fff' }
}

function toggleMetric (key: MetricKey) {
  const next = new Set(activeMetrics.value)
  if (next.has(key)) {
    if (next.size > 1) next.delete(key)
  } else {
    next.add(key)
  }
  activeMetrics.value = next
}

function rowMetricValue (row: TableRow, metric: MetricKey): number {
  if (metric === 'labor_pct') return row.labor_pct ?? 0
  if (metric === 'cogs_pct') return row.cogs_pct ?? 0
  if (metric === 'result_pct') return row.result_pct ?? 0
  if (metric === 'staff') return row.staff_count ?? 0
  if (metric === 'hours') return row.hours ?? 0
  return row[metric]
}

function formatMetricValue (n: number, metric: MetricKey): string {
  const def = metricDef(metric)
  if (def.scale === 'eur') return formatAccountingPnlCompact(n)
  if (def.scale === 'percent') return `${n.toFixed(1)}%`
  if (def.scale === 'hours') return `${Math.round(n)}h`
  return String(Math.round(n))
}

function formatBarValue (n: number, seriesKey?: string) {
  const key = (seriesKey as MetricKey | undefined) ?? [...activeMetrics.value][0] ?? 'revenue'
  return formatMetricValue(n, key)
}

function formatOpsTotal (n: number) {
  if (soleOpsMetric.value === 'hours') return `${Math.round(n)}h`
  return String(Math.round(n))
}

function formatOpsSegment (value: number, key?: string) {
  const label = key === 'ft' ? "FT'er" : key === 'pt' ? "PT'er" : key === 'zzp' ? 'ZZP' : ''
  if (soleOpsMetric.value === 'hours') {
    const hours = Math.round(value)
    return label ? `${label} ${hours}h` : `${hours}h`
  }
  const count = Math.round(value)
  return label ? `${label} ${count}` : String(count)
}

const soleMetricKey = computed((): MetricKey => [...activeMetrics.value][0] ?? 'revenue')

const metricSeries = computed(() => {
  if (activeMetrics.value.size !== 1) return []
  const metric = soleMetricKey.value
  return tableRows.value.map((row) => ({
    date: row.date,
    value: rowMetricValue(row, metric),
  }))
})

const barChartData = computed((): GroupedBarDataPoint[] => {
  if (showOpsStacked.value) return []
  const keys = activeMetricList.value.map((m) => m.key)
  if (!keys.length) return []

  const dates = keys.some((k) => needsOps(k))
    ? [...new Set([
        ...props.series.map((r) => r.date),
        ...opsSeries.value.map((r) => r.date),
      ])].sort()
    : props.series.map((r) => r.date)

  const byDate = new Map(tableRows.value.map((r) => [r.date, r]))
  return dates.map((date) => {
    const row = byDate.get(date)
    const point: GroupedBarDataPoint = { date }
    for (const key of keys) {
      point[key] = row ? rowMetricValue(row, key) : 0
    }
    return point
  })
})

const visibleSeries = computed((): GroupedBarSeries[] =>
  activeMetricList.value.map((m) => ({
    key: m.key,
    label: m.label,
    color: m.color,
  })),
)

const visibleContractKeys = computed((): ContractKey[] =>
  contractOptions.map((c) => c.id).filter((id) => activeContracts.value.has(id)),
)

const contractKeyLabels: Record<ContractKey, string> = {
  ft: "FT'er",
  pt: "PT'er",
  zzp: 'ZZP',
}

const visibleContractColors = computed(() =>
  visibleContractKeys.value.map(
    (id) => contractOptions.find((c) => c.id === id)?.color ?? '#374151',
  ),
)

const stackedChartData = computed((): StackedBarDataPoint[] => {
  if (soleOpsMetric.value === 'hours') {
    return opsSeries.value.map((row) => ({
      date: row.date,
      ft: row.hours_ft,
      pt: row.hours_pt,
      zzp: row.hours_zzp,
    }))
  }
  if (soleOpsMetric.value === 'staff') {
    return opsSeries.value.map((row) => ({
      date: row.date,
      ft: row.ft,
      pt: row.pt,
      zzp: row.zzp,
    }))
  }
  return []
})

const chartTitle = computed(() => {
  if (soleOpsMetric.value === 'staff') return 'Active staff — FT / PT / ZZP (unique per month)'
  if (soleOpsMetric.value === 'hours') return 'Gewerkt hours — FT / PT / ZZP'
  if (activeMetrics.value.size === 1) {
    return `${metricDef(soleMetricKey.value).label} — all sealed months`
  }
  return `${activeMetricList.value.map((m) => m.label).join(' · ')} — side by side`
})

function toggleAverage (id: 'trend' | 'median' | 'rolling') {
  const next = new Set(activeAverages.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  activeAverages.value = next
}

function toggleRolling (w: string) {
  const next = new Set(activeRolling.value)
  if (next.has(w)) next.delete(w)
  else next.add(w)
  activeRolling.value = next
}

function toggleContract (id: ContractKey) {
  const next = new Set(activeContracts.value)
  if (next.has(id)) {
    if (next.size <= 1) return
    next.delete(id)
  } else {
    next.add(id)
  }
  activeContracts.value = next
}

const chartReferenceLines = computed((): GroupedBarReferenceLine[] => {
  if (!showAverageControls.value) return []
  const data = metricSeries.value.filter((p) => Number.isFinite(p.value))
  const lines: GroupedBarReferenceLine[] = []
  if (!data.length || !activeAverages.value.size) return lines

  const metric = soleMetricKey.value
  const def = metricDef(metric)
  const formatTotal = (n: number) => formatMetricValue(n, metric)
  const barColor = def.color

  if (activeAverages.value.has('trend')) {
    const trend = chartTrendSeries(
      data.filter((p) => p.value !== 0 || metric === 'result' || metric === 'result_pct'),
    )
    if (trend.points.length >= 2) {
      const slopeLabel = def.scale === 'eur'
        ? `${trend.slopePerBucket >= 0 ? '+' : ''}${formatAccountingPnlCompact(trend.slopePerBucket)}/mo`
        : `${trend.slopePerBucket >= 0 ? '+' : ''}${trend.slopePerBucket.toFixed(def.scale === 'percent' ? 1 : 0)}${def.scale === 'percent' ? 'pp' : ''}/mo`
      const style = referenceLineStyleForAverage('trend')
      lines.push({
        id: 'pnl-trend',
        kind: 'series',
        points: trend.points,
        label: `${slopeLabel} · n=${trend.sampleCount}`,
        color: referenceLineColor(barColor, 'trend'),
        strokeWidth: style.strokeWidth,
        dashArray: style.dashArray,
        strokeLinecap: 'strokeLinecap' in style ? style.strokeLinecap : undefined,
      })
    }
  }

  if (activeAverages.value.has('median')) {
    const stat = chartPeriodMedian(
      data.filter((p) => p.value > 0 || metric === 'result' || metric === 'result_pct'),
    )
    if (stat.sampleCount > 0) {
      const style = referenceLineStyleForAverage('median')
      lines.push({
        id: 'pnl-median',
        kind: 'flat',
        value: stat.median,
        label: `Median ${formatTotal(stat.median)} · n=${stat.sampleCount}`,
        color: referenceLineColor(barColor, 'median'),
        strokeWidth: style.strokeWidth,
        dashArray: style.dashArray,
      })
    }
  }

  if (activeAverages.value.has('rolling')) {
    for (const windowLabel of rollingWindowLabels) {
      if (!activeRolling.value.has(windowLabel)) continue
      const days = ROLLING_DAYS[windowLabel]!
      const points = chartRollingMedianSeries(data, 'month', days)
      const last = [...points].reverse().find((p) => Number.isFinite(p.value))
      if (!last) continue
      const style = referenceLineStyleForAverage('rolling')
      lines.push({
        id: `pnl-${windowLabel}`,
        kind: 'series',
        points,
        label: `${windowLabel} ${formatTotal(last.value)}`,
        color: referenceLineColor(barColor, 'rolling'),
        strokeWidth: style.strokeWidth,
        dashArray: style.dashArray,
        strokeLinecap: 'strokeLinecap' in style ? style.strokeLinecap : undefined,
      })
    }
  }

  return lines
})

function captureChartSvgHtml (): string | null {
  const root = rootEl.value
  if (!root) return null
  const svgs = root.querySelectorAll('svg')
  if (!svgs.length) return null
  return Array.from(svgs).map((svg) => (svg as SVGElement).outerHTML).join('')
}

defineExpose({ captureChartSvgHtml })
</script>
