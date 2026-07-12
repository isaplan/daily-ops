<template>
  <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
    <div class="mb-4 flex flex-col gap-3">
      <div>
        <h2 class="text-sm font-semibold text-gray-900">{{ title }}</h2>
        <p v-if="subtitle" class="mt-0.5 text-xs text-gray-500">{{ subtitle }}</p>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Location</span>
          <button
            v-for="venue in venueOptions"
            :key="venue.locationId"
            type="button"
            class="rounded-full border-2 px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-opacity"
            :class="activeLocationIds.has(venue.locationId) ? 'text-white' : 'bg-white line-through opacity-45 hover:opacity-70'"
            :style="locationPillStyle(venue.locationId)"
            :aria-pressed="activeLocationIds.has(venue.locationId)"
            @click="toggleLocation(venue.locationId)"
          >
            {{ venue.shortLabel }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Metrics</span>
          <button
            v-for="metric in METRIC_DEFS"
            :key="metric.key"
            type="button"
            class="rounded-full border-2 px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-opacity"
            :class="metricButtonClass(metric.key)"
            :style="metricPillStyle(metric.key)"
            :aria-pressed="activeMetrics.has(metric.key)"
            @click="toggleMetric(metric.key)"
          >
            {{ metric.label }}
          </button>
        </div>

        <p v-if="multiLocationMode" class="text-[11px] text-gray-500">
          Comparing locations — {{ activeMetricLabel }} only.
        </p>

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
      </div>
    </div>

    <ClientOnly>
      <DailyOpsChartExpandShell
        :title="title"
        :expand-aria-label="`Expand ${title}`"
      >
        <template #default="{ width, height }">
          <D3StackedBarChart
            v-if="showStaffStacked && stackedChartData.length"
            :data="stackedChartData"
            :keys="contractStackKeys"
            :key-labels="contractStackLabels"
            :colors="contractStackColors"
            :width="width"
            :height="Math.max(280, Math.round(height))"
            :show-value-labels="showBars"
            :format-segment-value="formatStaffCount"
            :format-bucket-label="formatBucketLabel"
          />
          <D3GroupedBarChart
            v-else-if="chartData.length && visibleSeries.length"
            :data="chartData"
            :series="visibleSeries"
            :reference-lines="[]"
            :width="width"
            :height="Math.max(280, Math.round(height))"
            :show-bars="showBars"
            :normalize-series-scale="effectiveNormalizeScale"
            :always-show-bar-labels="effectiveNormalizeScale"
            :hide-y-axis="effectiveNormalizeScale"
            :format-bar-value="formatBarValue"
            :format-bucket-label="formatBucketLabel"
          />
          <p v-else class="py-12 text-center text-sm text-gray-500">No data for this selection.</p>
        </template>
      </DailyOpsChartExpandShell>
    </ClientOnly>

    <p v-if="showStaffStacked" class="mt-2 text-[11px] text-gray-500">
      Staff count by contract — FT / PT / ZZP stacked per hour.
    </p>
    <p v-else-if="effectiveNormalizeScale" class="mt-2 text-[11px] text-gray-500">
      Mixed metrics — bar heights are relative per series; values shown above each bar.
    </p>
  </div>
</template>

<script setup lang="ts">
import D3GroupedBarChart from '~/components/charts/D3GroupedBarChart.vue'
import D3StackedBarChart from '~/components/charts/D3StackedBarChart.vue'
import type { GroupedBarSeries } from '~/components/charts/D3GroupedBarChart.vue'
import type { StackedBarDataPoint } from '~/components/charts/D3StackedBarChart.vue'
import type { PeriodBreakdownDto, PeriodBreakdownGranularity } from '~/types/daily-ops-dashboard'
import type { StaffContractBucketKey } from '~/utils/dailyOpsStaffContractBuckets'
import {
  filterHourRowsForVenues,
  formatPeriodBreakdownBucketLabel,
  formatPeriodBreakdownEurPerHour,
  formatPeriodBreakdownMoney,
} from '~/utils/dailyOpsPeriodBreakdownChart'

type MetricKey = 'revenue' | 'labor' | 'productivity' | 'staff' | 'profit'

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

const GRANULARITY_TITLES: Record<PeriodBreakdownGranularity, string> = {
  hour: 'Hourly breakdown',
  day: 'Daily breakdown',
  week: 'Weekly breakdown',
  month: 'Monthly breakdown',
}

const contractStackKeys: StaffContractBucketKey[] = ['ft', 'pt', 'zzp']
const contractStackLabels: Record<StaffContractBucketKey, string> = {
  ft: 'FT',
  pt: 'PT',
  zzp: 'ZZP',
}
const contractStackColors = ['#3D5276', '#4F74E3', '#D9C73F']

const VENUE_SHORT: Record<string, string> = {
  'Van Kinsbergen': 'VKB',
  'Bar Bea': 'BEA',
  "l'Amour Toujours": 'LAT',
}

const props = defineProps<{
  breakdown: PeriodBreakdownDto
  businessDate?: string | null
  title?: string
  subtitle?: string
}>()

const { chartColorFor } = useDailyOpsLocationChartColors()

const title = computed(() => props.title ?? GRANULARITY_TITLES[props.breakdown.granularity])

const venueOptions = computed(() =>
  props.breakdown.byVenue.map((v) => ({
    locationId: v.locationId,
    locationName: v.locationName,
    shortLabel: VENUE_SHORT[v.locationName] ?? v.locationName.slice(0, 3).toUpperCase(),
    rows: v.rows,
  })),
)

const firstVenueId = computed(() => venueOptions.value[0]?.locationId ?? '')

const activeLocationIds = ref<Set<string>>(new Set())

watch(
  firstVenueId,
  (id) => {
    if (id) activeLocationIds.value = new Set([id])
  },
  { immediate: true },
)

const activeMetrics = ref<Set<MetricKey>>(new Set(['revenue']))

const multiLocationMode = computed(() => activeLocationIds.value.size > 1)

const activeMetricKey = computed((): MetricKey => [...activeMetrics.value][0] ?? 'revenue')

const activeMetricLabel = computed(
  () => METRIC_DEFS.find((m) => m.key === activeMetricKey.value)?.label ?? 'Revenue',
)

watch(multiLocationMode, (multi) => {
  if (multi && activeMetrics.value.size !== 1) {
    const metric: MetricKey = activeMetrics.value.has('staff') ? 'staff' : 'revenue'
    activeMetrics.value = new Set([metric])
  }
})

const showStaffStacked = computed(
  () =>
    !multiLocationMode.value
    && activeMetrics.value.size === 1
    && activeMetrics.value.has('staff'),
)

const stackedChartData = computed((): StackedBarDataPoint[] => {
  if (!showStaffStacked.value) return []
  const locationId = [...activeLocationIds.value][0]
  if (!locationId) return []
  return rowsForVenue(locationId).map((row) => ({
    date: row.bucketKey,
    ft: row.staffByContract?.ft ?? 0,
    pt: row.staffByContract?.pt ?? 0,
    zzp: row.staffByContract?.zzp ?? 0,
  }))
})

function formatStaffCount(value: number): string {
  return String(Math.round(value))
}

const showBars = ref(true)

function rowsForVenue(locationId: string) {
  const venue = venueOptions.value.find((v) => v.locationId === locationId)
  let rows = venue?.rows ?? []
  if (props.breakdown.granularity === 'hour' && props.businessDate) {
    rows = filterHourRowsForVenues(rows, [locationId], props.businessDate)
  } else {
    rows = rows.filter((r) => r.revenue > 0 || r.laborCost > 0 || r.profit !== 0 || r.staffCount > 0)
  }
  return rows
}

const bucketKeys = computed(() => {
  const keys = new Set<string>()
  for (const id of activeLocationIds.value) {
    for (const row of rowsForVenue(id)) keys.add(row.bucketKey)
  }
  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
})

const chartData = computed(() => {
  if (multiLocationMode.value) {
    const metric = activeMetricKey.value
    return bucketKeys.value.map((bucketKey) => {
      const point: Record<string, number | string> = { date: bucketKey }
      for (const id of activeLocationIds.value) {
        const row = rowsForVenue(id).find((r) => r.bucketKey === bucketKey)
        point[id] = metricValue(row, metric)
      }
      return point
    })
  }

  const locationId = [...activeLocationIds.value][0]
  if (!locationId) return []
  const rows = rowsForVenue(locationId)
  return rows.map((row) => ({
    date: row.bucketKey,
    revenue: row.revenue,
    labor: row.laborCost,
    productivity: row.productivity ?? 0,
    staff: row.staffCount,
    profit: row.profit,
  }))
})

function metricValue(
  row: { revenue: number; laborCost: number; productivity: number | null; staffCount: number; profit: number } | undefined,
  metric: MetricKey,
): number {
  if (!row) return 0
  if (metric === 'revenue') return row.revenue
  if (metric === 'labor') return row.laborCost
  if (metric === 'productivity') return row.productivity ?? 0
  if (metric === 'staff') return row.staffCount
  return row.profit
}

const visibleSeries = computed((): GroupedBarSeries[] => {
  if (multiLocationMode.value) {
    return venueOptions.value
      .filter((v) => activeLocationIds.value.has(v.locationId))
      .map((v) => ({
        key: v.locationId,
        label: v.shortLabel,
        color: chartColorFor(v.locationId),
      }))
  }
  return METRIC_DEFS.filter((m) => activeMetrics.value.has(m.key)).map((m) => ({
    key: m.key,
    label: m.label,
    color: m.color,
  }))
})

function toggleLocation(locationId: string) {
  const next = new Set(activeLocationIds.value)
  if (next.has(locationId)) {
    if (next.size > 1) next.delete(locationId)
  } else {
    next.add(locationId)
  }
  activeLocationIds.value = next
  if (next.size > 1 && activeMetrics.value.size !== 1) {
    const metric = activeMetrics.value.has('staff') ? 'staff' : 'revenue'
    activeMetrics.value = new Set([metric])
  }
}

function toggleMetric(key: MetricKey) {
  if (multiLocationMode.value) {
    activeMetrics.value = new Set([key])
    return
  }
  const next = new Set(activeMetrics.value)
  if (next.has(key)) {
    if (next.size > 1) next.delete(key)
  } else {
    next.add(key)
  }
  activeMetrics.value = next
}

function metricButtonClass(key: MetricKey) {
  return activeMetrics.value.has(key) ? 'text-white' : 'bg-white line-through opacity-45 hover:opacity-70'
}

function locationPillStyle(locationId: string) {
  const color = chartColorFor(locationId)
  if (!activeLocationIds.value.has(locationId)) {
    return { borderColor: color, color }
  }
  return { borderColor: color, backgroundColor: color, color: '#fff' }
}

function metricPillStyle(key: MetricKey) {
  const def = METRIC_DEFS.find((m) => m.key === key)!
  if (!activeMetrics.value.has(key)) {
    return { borderColor: def.color, color: def.color }
  }
  return { borderColor: def.color, backgroundColor: def.color, color: '#fff' }
}

const usesSharedEurScale = computed(() => {
  if (multiLocationMode.value) {
    const def = METRIC_DEFS.find((m) => m.key === activeMetricKey.value)
    return def?.scale === 'eur'
  }
  const active = METRIC_DEFS.filter((m) => activeMetrics.value.has(m.key))
  return active.length > 0 && active.every((m) => m.scale === 'eur')
})

const effectiveNormalizeScale = computed(() => !usesSharedEurScale.value)

function formatBucketLabel(bucketKey: string): string {
  const row = props.breakdown.byVenue
    .flatMap((v) => v.rows)
    .find((r) => r.bucketKey === bucketKey)
  return formatPeriodBreakdownBucketLabel(
    bucketKey,
    props.breakdown.granularity,
    row?.bucketLabel,
  )
}

function formatBarValue(value: number, seriesKey: string): string {
  if (!Number.isFinite(value)) return '—'
  const def = multiLocationMode.value
    ? METRIC_DEFS.find((m) => m.key === activeMetricKey.value)
    : METRIC_DEFS.find((m) => m.key === seriesKey)
  if (!def) return String(Math.round(value))
  if (def.scale === 'count') return String(Math.round(value))
  if (def.scale === 'eurPerHour') return formatPeriodBreakdownEurPerHour(value)
  return formatPeriodBreakdownMoney(value)
}
</script>
