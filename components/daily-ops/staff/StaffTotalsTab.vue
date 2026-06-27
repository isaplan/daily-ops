<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-[34px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
        Staff totals
      </h1>
      <p class="text-base text-gray-600">
        Gewerkte hours and headcount · {{ primaryRange.label }}
      </p>
    </header>

    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200">
      <div class="flex flex-wrap gap-1">
        <button
          v-for="tab in metricTabs"
          :key="tab.id"
          type="button"
          class="border-b-2 px-4 py-2 text-sm font-semibold transition-colors"
          :class="activeMetric === tab.id
            ? 'border-gray-900 text-gray-900'
            : 'border-transparent text-gray-500 hover:text-gray-800'"
          @click="activeMetric = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div
        v-if="hasChartData && !isLoading"
        class="relative z-0 mb-1 inline-flex shrink-0 flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-0.5"
        role="group"
        aria-label="Staff totals display mode"
      >
        <button
          type="button"
          class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
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
          class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
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

    <div v-if="isLoading" class="space-y-4 rounded-lg border-2 border-gray-900 bg-white p-4">
      <USkeleton class="h-4 w-56" />
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <USkeleton class="h-6 w-72" />
        <USkeleton class="h-6 w-44" />
      </div>
      <USkeleton class="h-72 w-full rounded-lg" />
    </div>

    <div v-else-if="hasChartData" class="rounded-lg border-2 border-gray-900 bg-white p-4">
      <div class="mb-4 flex flex-col gap-3">
        <h2 class="text-sm font-semibold">
          {{ activeMetric === 'hours' ? 'Hours worked' : 'Staff count' }}
          ({{ chartGranularityLabel }})
        </h2>

        <div
          v-if="viewMode === 'chart'"
          class="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <UiPillTabs
            v-model="venueFilter"
            class="order-1 shrink-0 sm:order-2"
            :options="venueFilterOptions"
            aria-label="Filter staff chart by venue"
          />
          <div class="order-2 flex flex-wrap items-center gap-3 sm:order-1">
            <div class="flex flex-wrap items-center gap-1">
              <span class="mr-1 text-xs font-medium text-gray-500">Reference</span>
              <button
                v-for="opt in referenceModeOptions"
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
            <div v-if="activeReferences.has('rolling')" class="flex flex-wrap items-center gap-1">
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
        <p v-if="referenceHelpText" class="text-xs leading-snug text-gray-500">
          {{ referenceHelpText }}
        </p>
      </div>

      <DailyOpsChartExpandShell
        v-if="viewMode === 'chart'"
        :title="chartTitle"
        expand-aria-label="Expand staff chart"
        :default-width="760"
        :default-height="320"
      >
        <template #default="{ width, height }">
          <D3GroupedBarChart
            :data="barChartData"
            :series="barChartSeries"
            :reference-lines="chartReferenceLines"
            :date-granularity="chartGranularity"
            :width="width"
            :height="Math.max(280, Math.round(height))"
          />
        </template>
      </DailyOpsChartExpandShell>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-gray-500">
              <th class="py-1 pr-4">Period</th>
              <th
                v-for="s in tableBarChartSeries"
                :key="s.key"
                class="py-1 text-right"
              >
                {{ s.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in tableBarChartData"
              :key="row.date"
              class="border-t border-gray-100"
            >
              <td class="py-1 pr-4 tabular-nums">{{ formatBucketDate(String(row.date)) }}</td>
              <td
                v-for="s in tableBarChartSeries"
                :key="`${row.date}-${s.key}`"
                class="py-1 text-right tabular-nums"
              >
                {{ formatMetricValue(Number(row[s.key]) || 0) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p v-else-if="!isLoading" class="text-gray-600">No labor snapshot data for this range.</p>

    <p v-if="!isLoading && timeseries?.coverage" class="text-xs text-gray-500">
      Coverage: {{ timeseries.coverage.daysFound }} / {{ timeseries.coverage.daysExpected }} days
    </p>
  </section>
</template>

<script setup lang="ts">
import D3GroupedBarChart from '~/components/charts/D3GroupedBarChart.vue'
import type { GroupedBarDataPoint, GroupedBarReferenceLine, GroupedBarSeries } from '~/components/charts/D3GroupedBarChart.vue'
import type { DailyOpsStaffTimeseriesPoint } from '~/types/daily-ops-staff'
import { REVENUE_LOCATIONS } from '~/utils/dailyOpsRevenueAnalyticsNav'
import {
  REFERENCE_LINE_STYLES,
  referenceLineColor,
} from '~/utils/chartReferenceColor'
import {
  STAFF_REFERENCE_WINDOWS,
  STAFF_ROLLING_WINDOW_DAYS,
  staffPeriodMedian,
  staffRollingMedianSeries,
  staffTrendSeries,
} from '~/utils/dailyOpsStaffChartMedians'
import type { StaffNavMode } from '~/utils/dailyOpsStaffNav/modes'
import { formatStaffChartBucketLabel } from '~/utils/dailyOpsStaffChartLabels'

type LocationRow = { _id: string; name: string; chartColor?: string }

const FALLBACK_VENUE_COLORS: Record<string, string> = {
  '69d6cfa63d2adf93b79d1ae7': '#2563eb',
  '69d6cfa63d2adf93b79d1ae6': '#059669',
  '69d6cfa73d2adf93b79d1ae8': '#d97706',
}

const VENUE_ORDER = REVENUE_LOCATIONS.filter((l) => l.id).map((l) => l.id!)
const rollingWindowLabels = ['30d', '60d', '90d'] as const

const {
  timeseries,
  isLoading,
  primaryRange,
  chartGranularityLabel,
  chartGranularity,
  staffMode,
} = useDailyOpsStaffMetrics()

const { data: locationsRes } = useFetch<{ success: boolean; data: LocationRow[] }>(
  '/api/daily-ops/locations',
  { key: 'daily-ops-locations-staff-totals' },
)

const metricTabs = [
  { id: 'hours' as const, label: 'Hours' },
  { id: 'staff' as const, label: 'Staff' },
]
const referenceModeOptions = [
  { id: 'trend' as const, label: 'Trend' },
  { id: 'median' as const, label: 'Median' },
  { id: 'rolling' as const, label: 'Rolling' },
]

type ReferenceLayer = (typeof referenceModeOptions)[number]['id']

const activeMetric = ref<'hours' | 'staff'>('hours')
const viewMode = ref<'chart' | 'table'>('chart')
const venueFilter = ref('all')
const activeReferences = ref(new Set<ReferenceLayer>(['trend']))
const activeRolling = ref(new Set<string>(['30d']))

const venueFilterOptions = [
  { value: 'all', label: 'All' },
  ...REVENUE_LOCATIONS.filter((l) => l.id).map((l) => ({
    value: l.id!,
    label: l.abbrev,
  })),
]

const chartLocation = computed(() =>
  venueFilter.value === 'all' ? null : venueFilter.value,
)

const allVenueSeries = computed(() => {
  const rows = timeseries.value?.byLocation ?? []
  return VENUE_ORDER.map((locationId) => {
    const loc = rows.find((r) => r.locationId === locationId)
    const meta = REVENUE_LOCATIONS.find((l) => l.id === locationId)
    return {
      locationId,
      locationName: meta?.abbrev ?? loc?.locationName ?? locationId,
      points: loc?.points ?? [],
    }
  })
})

const chartSeries = computed(() => {
  if (!chartLocation.value) return allVenueSeries.value
  return allVenueSeries.value.filter((s) => s.locationId === chartLocation.value)
})

const barChartSeries = computed((): GroupedBarSeries[] =>
  chartSeries.value.map((s) => ({
    key: s.locationId,
    label: s.locationName,
    color: locationColor(s.locationId),
  })),
)

const barChartData = computed((): GroupedBarDataPoint[] => buildBarData(chartSeries.value))

const tableBarChartSeries = computed((): GroupedBarSeries[] =>
  allVenueSeries.value.map((s) => ({
    key: s.locationId,
    label: s.locationName,
    color: locationColor(s.locationId),
  })),
)

const tableBarChartData = computed((): GroupedBarDataPoint[] => buildBarData(allVenueSeries.value))

function buildBarData(
  series: typeof chartSeries.value,
): GroupedBarDataPoint[] {
  if (!series.length) return []
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort()
  return dates.map((date) => {
    const row: GroupedBarDataPoint = { date }
    for (const s of series) {
      const p = s.points.find((x) => x.date === date)
      row[s.locationId] = p ? metricValue(p) : 0
    }
    return row
  })
}

const hasChartData = computed(() =>
  allVenueSeries.value.some((s) => s.points.length > 0),
)

const chartReferenceLines = computed((): GroupedBarReferenceLine[] => {
  const series = chartSeries.value.filter((s) => s.points.length > 0)
  if (!series.length) return []

  const unit = chartGranularityLabel.value.replace('per ', '')
  const suffix = activeMetric.value === 'hours' ? 'h' : ''
  const decimals = activeMetric.value === 'hours' ? 1 : 0
  const metric = activeMetric.value
  const lines: GroupedBarReferenceLine[] = []

  if (activeReferences.value.has('trend')) {
    const style = REFERENCE_LINE_STYLES.trend
    for (const s of series) {
      const trend = staffTrendSeries(s.points, metric)
      if (trend.points.length < 2) continue
      const arrow = trend.slopePerBucket > 0.05 ? '↑' : trend.slopePerBucket < -0.05 ? '↓' : '→'
      const slopeLabel = `${trend.slopePerBucket >= 0 ? '+' : ''}${trend.slopePerBucket.toFixed(decimals)}${suffix}/${unit}`
      lines.push({
        id: `trend-${s.locationId}`,
        kind: 'series',
        points: trend.points,
        label: `${s.locationName} ${arrow} ${slopeLabel} · n=${trend.sampleCount}`,
        color: referenceLineColor(locationColor(s.locationId), 'trend'),
        strokeWidth: style.strokeWidth,
      })
    }
  }

  if (activeReferences.value.has('median')) {
    const style = REFERENCE_LINE_STYLES.median
    for (const s of series) {
      const stat = staffPeriodMedian(s.points, metric)
      if (stat.median <= 0 || !stat.fromDate || !stat.toDate) continue
      lines.push({
        id: `median-${s.locationId}`,
        kind: 'flat',
        value: stat.median,
        fromDate: stat.fromDate,
        toDate: stat.toDate,
        label: `${s.locationName} med ${stat.median.toFixed(decimals)}${suffix}/${unit} · n=${stat.sampleCount}`,
        color: referenceLineColor(locationColor(s.locationId), 'median'),
        dashArray: style.dashArray,
        strokeWidth: style.strokeWidth,
      })
    }
  }

  if (activeReferences.value.has('rolling')) {
    const style = REFERENCE_LINE_STYLES.rolling
    for (const windowLabel of rollingWindowLabels) {
      if (!activeRolling.value.has(windowLabel)) continue
      const days = STAFF_ROLLING_WINDOW_DAYS[windowLabel]!

      for (const s of series) {
        const points = staffRollingMedianSeries(s.points, chartGranularity.value, days, metric)
        const last = [...points].reverse().find((p) => p.value > 0)
        if (!last) continue
        lines.push({
          id: `${windowLabel}-${s.locationId}`,
          kind: 'series',
          points,
          label: `${s.locationName} ${windowLabel} ${last.value.toFixed(decimals)}${suffix}`,
          color: referenceLineColor(locationColor(s.locationId), 'rolling'),
          dashArray: style.dashArray,
          strokeWidth: style.strokeWidth,
        })
      }
    }
  }

  return lines
})

function toggleReference(layer: ReferenceLayer) {
  const next = new Set(activeReferences.value)
  if (next.has(layer)) next.delete(layer)
  else next.add(layer)
  activeReferences.value = next
}

function toggleRolling(label: string) {
  const next = new Set(activeRolling.value)
  if (next.has(label)) next.delete(label)
  else next.add(label)
  activeRolling.value = next
}

function metricValue(p: DailyOpsStaffTimeseriesPoint): number {
  return activeMetric.value === 'hours' ? p.gewerkt_hours : p.staff_count
}

function fmtHours(n: number) {
  return Number.isFinite(n) ? n.toFixed(1) : '—'
}

function fmtCount(n: number) {
  return Number.isFinite(n) ? String(Math.round(n)) : '—'
}

function formatBucketDate(bucketKey: string) {
  return formatStaffChartBucketLabel(bucketKey, chartGranularity.value)
}

function formatMetricValue(n: number) {
  return activeMetric.value === 'hours' ? fmtHours(n) : fmtCount(n)
}

function locationColor(locationId: string): string {
  const fromApi = locationsRes.value?.data?.find((l) => l._id === locationId)?.chartColor
  if (fromApi) return fromApi
  return FALLBACK_VENUE_COLORS[locationId] ?? '#6b7280'
}

const chartTitle = computed(() =>
  activeMetric.value === 'hours' ? 'Hours worked' : 'Staff count',
)

function trendWindowLabel(mode: StaffNavMode): string {
  return STAFF_REFERENCE_WINDOWS.trend[mode]
}

const referenceHelpText = computed(() => {
  if (viewMode.value !== 'chart') return ''
  if (!activeReferences.value.size) {
    return 'Toggle Trend, Median, and/or Rolling to overlay reference lines on the chart.'
  }

  const longWin = trendWindowLabel(staffMode.value)
  const parts: string[] = []

  if (activeReferences.value.has('trend')) {
    parts.push(`Solid (darker) = trend over ${longWin}`)
  }
  if (activeReferences.value.has('median')) {
    parts.push('Dashed = median')
  }
  if (activeReferences.value.has('rolling')) {
    const rolling = [...activeRolling.value].sort().join(', ') || '30d'
    parts.push(`Dotted = rolling ${rolling}`)
  }

  return `${parts.join(' · ')}. Each line is a darker shade of the bar colour (median −10%, trend −20%, rolling −30%).`
})
</script>
