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

    <div class="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200">
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

    <div v-else-if="hasChartData" class="space-y-2">
      <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
        <div class="mb-4 flex flex-col gap-3">
          <h2 class="text-sm font-semibold">
            {{ chartMetricHeading }}
          </h2>

          <div v-if="viewMode === 'chart'" class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-1">
              <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Graph</span>
              <UiPillTabs
                v-model="graphType"
                :options="graphTypeOptions"
                aria-label="Staff chart graph type"
              />
            </div>

            <div class="flex flex-wrap items-center gap-1">
              <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Location</span>
              <UiPillTabs
                v-model="venueFilter"
                class="shrink-0"
                :options="venueFilterOptions"
                aria-label="Filter staff chart by venue"
              />
            </div>

            <div v-if="graphType === 'stacked'" class="flex flex-wrap items-center gap-1">
              <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Contract</span>
              <div class="flex flex-wrap items-center gap-1.5">
                <span
                  v-for="(key, i) in contractStackKeys"
                  :key="key"
                  class="relative inline-flex items-center overflow-hidden rounded-md px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
                  :style="{ backgroundColor: contractStackColors[i] }"
                >
                  <span class="absolute inset-0 bg-black/45" aria-hidden="true" />
                  <span class="relative">{{ contractStackLabels[key] }}</span>
                </span>
              </div>
            </div>

            <div v-if="graphType === 'bars'" class="flex flex-col gap-2">
              <div class="flex flex-wrap items-center gap-1">
                <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Reference</span>
                <button
                  v-for="opt in referenceMetricOptions"
                  :key="opt.id"
                  type="button"
                  class="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
                  :class="activeReferenceMetrics.has(opt.id)
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'"
                  @click="toggleReferenceMetric(opt.id)"
                >
                  {{ opt.label }}
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-1">
                <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Contract</span>
                <UiPillTabs
                  v-model="contractFilter"
                  :options="contractFilterOptions"
                  aria-label="Filter staff chart by contract type"
                />
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
            </div>

            <div
              v-if="showChartAverageControls"
              class="flex flex-col gap-2"
            >
              <div class="flex flex-wrap items-center gap-1">
                <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">
                  {{ graphType === 'bars' ? 'Averages' : 'Total overlay' }}
                </span>
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
              <p v-if="graphType !== 'bars'" class="text-[11px] text-gray-500">
                Lines track total {{ chartMetricNoun }} (bars stay mix / team split).
              </p>
            </div>

            <div
              v-if="graphType === 'teams' && availableTeamGroups.length"
              class="flex flex-col gap-2"
            >
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Teams</span>
                <button
                  v-for="groupKey in availableTeamGroups"
                  :key="groupKey"
                  type="button"
                  class="rounded-full border-2 px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-opacity"
                  :class="activeTeams.has(groupKey) ? 'text-white' : 'bg-white line-through opacity-45 hover:opacity-70'"
                  :style="teamPillStyle(groupKey)"
                  :aria-pressed="activeTeams.has(groupKey)"
                  @click="toggleTeam(groupKey)"
                >
                  {{ staffTeamGroupLabel(groupKey) }}
                </button>
              </div>
              <div class="flex flex-wrap items-center gap-1">
                <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Bars</span>
                <UiPillTabs
                  v-model="teamStackDisplay"
                  :options="teamStackDisplayOptions"
                  aria-label="Team chart absolute or percent"
                />
              </div>
              <div class="flex flex-wrap items-center gap-1">
                <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Contract</span>
                <UiPillTabs
                  v-model="contractFilter"
                  :options="contractFilterOptions"
                  aria-label="Filter team chart by contract type"
                />
              </div>
            </div>
          </div>
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
            v-if="graphType === 'bars'"
            :data="barChartData"
            :series="barChartSeries"
            :reference-lines="chartReferenceLines"
            :date-granularity="chartGranularity"
            :show-bars="showBars"
            :format-bar-value="formatBarValue"
            :width="width"
            :height="Math.max(280, Math.round(height))"
          />
          <D3StackedBarChart
            v-else-if="graphType === 'stacked'"
            :data="stackedChartData"
            :keys="contractStackKeys"
            :key-labels="contractStackLabels"
            :colors="contractStackColors"
            :reference-lines="contractStackReferenceLines"
            :date-granularity="chartGranularity"
            show-percent-labels
            :width="width"
            :height="Math.max(280, Math.round(height))"
          />
          <D3StackedBarChart
            v-else
            :data="teamStackedChartData"
            :keys="visibleTeamKeys"
            :key-labels="teamKeyLabels"
            :colors="teamStackColors"
            :reference-lines="teamStackReferenceLines"
            :date-granularity="chartGranularity"
            :show-percent-labels="teamStackDisplay === 'percent'"
            :show-value-labels="teamStackDisplay === 'absolute'"
            :format-segment-value="formatTeamSegmentValue"
            hide-legend
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

      <p
        v-if="viewMode === 'chart' && chartLegendText"
        class="text-xs leading-snug text-gray-500"
      >
        {{ chartLegendText }}
      </p>
    </div>

    <p v-else-if="!isLoading" class="text-gray-600">No labor snapshot data for this range.</p>

    <p v-if="!isLoading && timeseries?.coverage" class="text-xs text-gray-500">
      Coverage: {{ timeseries.coverage.daysFound }} / {{ timeseries.coverage.daysExpected }} days
    </p>
  </section>
</template>

<script setup lang="ts">
import D3GroupedBarChart from '~/components/charts/D3GroupedBarChart.vue'
import D3StackedBarChart from '~/components/charts/D3StackedBarChart.vue'
import type { GroupedBarDataPoint, GroupedBarReferenceLine, GroupedBarSeries } from '~/components/charts/D3GroupedBarChart.vue'
import type { StackedBarDataPoint, StackedBarReferenceLine } from '~/components/charts/D3StackedBarChart.vue'
import type { DailyOpsStaffContractBucketMetrics, DailyOpsStaffTeamSeriesPoint, DailyOpsStaffTimeseriesPoint } from '~/types/daily-ops-staff'
import { REVENUE_LOCATIONS } from '~/utils/dailyOpsRevenueAnalyticsNav'
import {
  referenceLineColor,
  referenceLineColorForOverlay,
  referenceLineStyleForAverage,
} from '~/utils/chartReferenceColor'
import {
  STAFF_REFERENCE_WINDOWS,
  STAFF_ROLLING_WINDOW_DAYS,
  chartTrendSeries,
  chartPeriodMedian,
  chartRollingMedianSeries,
} from '~/utils/dailyOpsStaffChartMedians'
import type { StaffNavMode } from '~/utils/dailyOpsStaffNav/modes'
import { formatStaffChartBucketLabel } from '~/utils/dailyOpsStaffChartLabels'
import {
  applyStaffContractFilter,
  type StaffContractBucketKey,
  type StaffContractFilter,
} from '~/utils/dailyOpsStaffContractBuckets'
import {
  staffTeamGroupColor,
  staffTeamGroupKey,
  staffTeamGroupLabel,
  staffTeamGroupSortIndex,
  type StaffTeamGroupKey,
} from '~/utils/dailyOpsStaffTeamGroups'

type StaffGraphType = 'bars' | 'stacked' | 'teams'

const contractStackKeys: StaffContractBucketKey[] = ['ft', 'pt', 'zzp']
const contractStackLabels: Record<StaffContractBucketKey, string> = {
  ft: 'FT',
  pt: 'PT',
  zzp: 'ZZP',
}
const contractStackColors = ['#3D5276', '#4F74E3', '#D9C73F']

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

const { formatEur } = useDashboardEurFormat()

const { data: locationsRes } = useFetch<{ success: boolean; data: LocationRow[] }>(
  '/api/daily-ops/locations',
  { key: 'daily-ops-locations-staff-totals' },
)

type StaffChartMetric = 'hours' | 'staff' | 'costs'

const metricTabs = [
  { id: 'hours' as const, label: 'Hours' },
  { id: 'staff' as const, label: 'Staff' },
  { id: 'costs' as const, label: 'Labor costs' },
]
const referenceMetricOptions = computed(() => [
  {
    id: 'hours' as const,
    label:
      activeMetric.value === 'hours'
        ? 'Hours'
        : activeMetric.value === 'staff'
          ? 'Staff'
          : 'Hours',
  },
  { id: 'revenue' as const, label: 'Revenue' },
  { id: 'costs' as const, label: 'Costs' },
])
const averageOptions = [
  { id: 'trend' as const, label: 'Trend' },
  { id: 'median' as const, label: 'Median' },
  { id: 'rolling' as const, label: 'Rolling' },
]

type ReferenceMetric = (typeof referenceMetricOptions)[number]['id']
type AverageType = (typeof averageOptions)[number]['id']

const activeMetric = ref<StaffChartMetric>('hours')
const viewMode = ref<'chart' | 'table'>('chart')
const graphType = ref<StaffGraphType>('bars')
const showBars = ref(true)
const venueFilter = ref('all')
const contractFilter = ref<StaffContractFilter>('all')
const activeReferenceMetrics = ref(new Set<ReferenceMetric>(['hours']))
const activeAverages = ref(new Set<AverageType>(['trend']))
const activeRolling = ref(new Set<string>(['30d']))
const activeTeams = ref(new Set<StaffTeamGroupKey>())
const teamStackDisplay = ref<'absolute' | 'percent'>('absolute')

const showChartAverageControls = computed(() => {
  if (graphType.value === 'bars' || graphType.value === 'stacked') return true
  return graphType.value === 'teams' && teamStackDisplay.value === 'absolute'
})

const teamStackDisplayOptions = [
  { value: 'absolute', label: 'Absolute' },
  { value: 'percent', label: '%' },
]

const venueFilterOptions = [
  { value: 'all', label: 'All' },
  ...REVENUE_LOCATIONS.filter((l) => l.id).map((l) => ({
    value: l.id!,
    label: l.abbrev,
  })),
]

const contractFilterOptions = [
  { value: 'all', label: 'All' },
  { value: 'ft', label: 'FT' },
  { value: 'pt', label: 'PT' },
  { value: 'zzp', label: 'ZZP' },
]

const graphTypeOptions = [
  { value: 'bars', label: 'Location' },
  { value: 'stacked', label: 'Contract' },
  { value: 'teams', label: 'Teams' },
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
  const base = !chartLocation.value
    ? allVenueSeries.value
    : allVenueSeries.value.filter((s) => s.locationId === chartLocation.value)
  return base.map((s) => ({
    ...s,
    points: applyStaffContractFilter(s.points, contractFilter.value),
  }))
})

const stackedVenueSeries = computed(() => {
  if (!chartLocation.value) return allVenueSeries.value
  return allVenueSeries.value.filter((s) => s.locationId === chartLocation.value)
})

const teamVenueSeries = computed(() => {
  if (!chartLocation.value) {
    return [{
      locationId: 'all',
      locationName: 'All',
      points: timeseries.value?.current ?? [],
    }]
  }
  return allVenueSeries.value.filter((s) => s.locationId === chartLocation.value)
})

const availableTeamGroups = computed((): StaffTeamGroupKey[] => {
  const keys = new Set<StaffTeamGroupKey>()
  for (const s of teamVenueSeries.value) {
    for (const p of s.points) {
      for (const t of p.teams ?? []) {
        if (teamMetricValue(t) > 0) {
          keys.add(staffTeamGroupKey(t.teamName))
        }
      }
    }
  }
  return [...keys].sort(
    (a, b) => staffTeamGroupSortIndex(a) - staffTeamGroupSortIndex(b),
  )
})

watch(availableTeamGroups, (groups, prev) => {
  const avail = new Set(groups)
  const next = new Set<StaffTeamGroupKey>()
  for (const t of activeTeams.value) {
    if (avail.has(t)) next.add(t)
  }
  for (const t of groups) {
    if (!prev?.includes(t)) next.add(t)
  }
  if (next.size === 0) {
    groups.forEach((t) => next.add(t))
  }
  activeTeams.value = next
}, { immediate: true })

const visibleTeamKeys = computed(() =>
  availableTeamGroups.value.filter((t) => activeTeams.value.has(t)),
)

const teamKeyLabels = computed(() =>
  Object.fromEntries(
    availableTeamGroups.value.map((k) => [k, staffTeamGroupLabel(k)]),
  ),
)

const teamStackColors = computed(() =>
  visibleTeamKeys.value.map((key) => staffTeamGroupColor(key)),
)

const teamStackedChartDataRaw = computed((): StackedBarDataPoint[] =>
  buildTeamStackedData(teamVenueSeries.value, visibleTeamKeys.value),
)

const teamStackedChartData = computed((): StackedBarDataPoint[] => {
  const data = teamStackedChartDataRaw.value
  if (teamStackDisplay.value === 'percent') {
    return data.map((row) => {
      const total = visibleTeamKeys.value.reduce(
        (sum, key) => sum + (Number(row[key]) || 0),
        0,
      )
      if (total <= 0) return { ...row }
      const out: StackedBarDataPoint = { date: row.date }
      for (const key of visibleTeamKeys.value) {
        out[key] = Math.round(((Number(row[key]) || 0) / total) * 1000) / 10
      }
      return out
    })
  }
  return data
})

const teamTotalSeries = computed(() =>
  teamStackedChartDataRaw.value.map((row) => ({
    date: String(row.date),
    value: visibleTeamKeys.value.reduce((sum, key) => sum + (Number(row[key]) || 0), 0),
  })),
)

const stackedChartData = computed((): StackedBarDataPoint[] => buildStackedData(stackedVenueSeries.value))

const stackedTotalSeries = computed(() =>
  stackedChartData.value.map((row) => ({
    date: String(row.date),
    value: contractStackKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0),
  })),
)

function buildStackedTotalReferenceLines(
  rows: Array<{ date: string; value: number }>,
  idPrefix: string,
): StackedBarReferenceLine[] {
  const data = rows.filter((p) => p.value > 0)
  if (!data.length || !activeAverages.value.size) return []

  const unit = chartGranularityLabel.value.replace('per ', '')
  const metric = activeMetric.value
  const isEuro = metric === 'costs'
  const suffix = metric === 'hours' ? 'h' : ''
  const decimals = metric === 'hours' ? 1 : 0
  const formatTotal = (n: number) => (isEuro ? formatEur(n) : `${n.toFixed(decimals)}${suffix}`)
  const lines: StackedBarReferenceLine[] = []

  if (activeAverages.value.has('trend')) {
    const trend = chartTrendSeries(data)
    if (trend.points.length >= 2) {
      const slopeLabel = isEuro
        ? `${trend.slopePerBucket >= 0 ? '+' : ''}${formatEur(trend.slopePerBucket)}/${unit}`
        : `${trend.slopePerBucket >= 0 ? '+' : ''}${trend.slopePerBucket.toFixed(decimals)}${suffix}/${unit}`
      const style = referenceLineStyleForAverage('trend')
      lines.push({
        id: `${idPrefix}-trend`,
        kind: 'series',
        points: trend.points,
        label: `Total ${slopeLabel} · n=${trend.sampleCount}`,
        color: referenceLineColor('#374151', 'trend'),
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
        id: `${idPrefix}-median`,
        kind: 'flat',
        value: stat.median,
        label: `Total med ${formatTotal(stat.median)}/${unit} · n=${stat.sampleCount}`,
        color: referenceLineColor('#374151', 'median'),
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
        id: `${idPrefix}-${windowLabel}`,
        kind: 'series',
        points,
        label: `Total ${windowLabel} ${formatTotal(last.value)}`,
        color: referenceLineColor('#374151', 'rolling'),
        strokeWidth: style.strokeWidth,
        dashArray: style.dashArray,
        strokeLinecap: 'strokeLinecap' in style ? style.strokeLinecap : undefined,
      })
    }
  }

  return lines
}

const contractStackReferenceLines = computed((): StackedBarReferenceLine[] => {
  if (graphType.value !== 'stacked') return []
  return buildStackedTotalReferenceLines(stackedTotalSeries.value, 'contract')
})

const teamStackReferenceLines = computed((): StackedBarReferenceLine[] => {
  if (graphType.value !== 'teams' || teamStackDisplay.value === 'percent') return []
  return buildStackedTotalReferenceLines(teamTotalSeries.value, 'team')
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

const tableBarChartData = computed((): GroupedBarDataPoint[] =>
  buildBarData(
    allVenueSeries.value.map((s) => ({
      ...s,
      points: applyStaffContractFilter(s.points, contractFilter.value),
    })),
  ),
)

function buildTeamStackedData(
  series: typeof allVenueSeries.value,
  groupKeys: StaffTeamGroupKey[],
): StackedBarDataPoint[] {
  if (!series.length || !groupKeys.length) return []
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort()
  return dates.map((date) => {
    const row: StackedBarDataPoint = { date }
    for (const groupKey of groupKeys) {
      row[groupKey] = roundMetric(
        series.reduce((sum, s) => {
          const p = s.points.find((x) => x.date === date)
          const t = p?.teams?.find((x) => x.teamName === groupKey)
          return sum + (t ? teamMetricValue(t) : 0)
        }, 0),
      )
    }
    return row
  })
}

function teamLoadedCost(team: DailyOpsStaffTeamSeriesPoint): number {
  const bc = team.byContract
  if (!bc) return 0
  return (bc.ft?.loaded_cost ?? 0) + (bc.pt?.loaded_cost ?? 0) + (bc.zzp?.loaded_cost ?? 0)
}

function teamMetricValue(team: DailyOpsStaffTeamSeriesPoint): number {
  if (contractFilter.value !== 'all') {
    const slice = team.byContract?.[contractFilter.value]
    if (!slice) return 0
    if (activeMetric.value === 'hours') return slice.gewerkt_hours
    if (activeMetric.value === 'staff') return slice.staff_count
    return slice.loaded_cost
  }
  if (activeMetric.value === 'hours') return team.gewerkt_hours
  if (activeMetric.value === 'staff') return team.staff_count
  return teamLoadedCost(team)
}

function buildStackedData(
  series: typeof allVenueSeries.value,
): StackedBarDataPoint[] {
  if (!series.length) return []
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort()
  return dates.map((date) => {
    const row: StackedBarDataPoint = { date }
    for (const key of contractStackKeys) {
      row[key] = roundMetric(
        series.reduce((sum, s) => {
          const p = s.points.find((x) => x.date === date)
          return sum + (p ? contractBucketMetric(p, key) : 0)
        }, 0),
      )
    }
    return row
  })
}

function contractBucketMetric(
  point: DailyOpsStaffTimeseriesPoint,
  key: StaffContractBucketKey,
): number {
  const slice: DailyOpsStaffContractBucketMetrics | undefined = point.byContract?.[key]
  if (!slice) return 0
  if (activeMetric.value === 'hours') return slice.gewerkt_hours
  if (activeMetric.value === 'staff') return slice.staff_count
  return slice.loaded_cost
}

function roundMetric(n: number): number {
  if (activeMetric.value === 'hours') return Math.round(n * 10) / 10
  if (activeMetric.value === 'costs') return Math.round(n * 100) / 100
  return Math.round(n)
}

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
  allVenueSeries.value.some((s) =>
    s.points.some(
      (p) =>
        p.gewerkt_hours > 0 ||
        p.staff_count > 0 ||
        (p.labor_loaded_cost ?? 0) > 0,
    ),
  ),
)

function referenceLineYAxis(
  refMetric: ReferenceMetric,
  barMetric: StaffChartMetric,
): 'right' | undefined {
  const refIsEuro = refMetric === 'revenue' || refMetric === 'costs'
  const barIsEuro = barMetric === 'costs'
  if (barIsEuro && !refIsEuro) return 'right'
  if (!barIsEuro && refIsEuro) return 'right'
  return undefined
}

const chartReferenceLines = computed((): GroupedBarReferenceLine[] => {
  const series = chartSeries.value.filter((s) => s.points.length > 0)
  if (!series.length || !activeReferenceMetrics.value.size || !activeAverages.value.size) return []

  const unit = chartGranularityLabel.value.replace('per ', '')
  const barMetric = activeMetric.value
  const barSuffix = barMetric === 'hours' ? 'h' : ''
  const barDecimals = barMetric === 'hours' ? 1 : 0
  const lines: GroupedBarReferenceLine[] = []

  for (const refMetric of activeReferenceMetrics.value) {
    for (const avg of activeAverages.value) {
      const refIsEuro = refMetric === 'revenue' || refMetric === 'costs'
      const style = referenceLineStyleForAverage(avg)
      const yAxis = referenceLineYAxis(refMetric, barMetric)
      const prefix =
        refMetric === 'revenue' ? 'rev' : refMetric === 'costs' ? 'cost' : ''

      const rowsFor = (points: DailyOpsStaffTimeseriesPoint[]) =>
        points.map((p) => ({
          date: p.date,
          value:
            refMetric === 'hours'
              ? barMetric === 'hours'
                ? p.gewerkt_hours
                : barMetric === 'staff'
                  ? p.staff_count
                  : p.gewerkt_hours
              : refMetric === 'revenue'
                ? p.revenue_ex_vat ?? 0
                : p.labor_loaded_cost ?? 0,
        }))

      if (avg === 'trend') {
        for (const s of series) {
          const trend = chartTrendSeries(rowsFor(s.points))
          if (trend.points.length < 2) continue
          const slope = trend.slopePerBucket
          const isStaffBar = barMetric === 'staff' && refMetric === 'hours'
          const arrow = refIsEuro
            ? slope > 50
              ? '↑'
              : slope < -50
                ? '↓'
                : '→'
            : isStaffBar
              ? slope > 0.2
                ? '↑'
                : slope < -0.2
                  ? '↓'
                  : '→'
              : slope > 0.05
                ? '↑'
                : slope < -0.05
                  ? '↓'
                  : '→'
          const slopeLabel = refIsEuro
            ? `${slope >= 0 ? '+' : ''}${formatEur(slope)}/${unit}`
            : `${slope >= 0 ? '+' : ''}${slope.toFixed(barDecimals)}${barSuffix}/${unit}`
          lines.push({
            id: `${refMetric}-trend-${s.locationId}`,
            kind: 'series',
            points: trend.points,
            label: `${s.locationName}${prefix ? ` ${prefix}` : ''} ${arrow} ${slopeLabel} · n=${trend.sampleCount}`,
            color: referenceLineColorForOverlay(locationColor(s.locationId), {
              euro: refIsEuro ? refMetric : undefined,
              average: 'trend',
            }),
            strokeWidth: style.strokeWidth,
            dashArray: style.dashArray,
            strokeLinecap: 'strokeLinecap' in style ? style.strokeLinecap : undefined,
            yAxis,
          })
        }
      }

      if (avg === 'median') {
        for (const s of series) {
          const stat = chartPeriodMedian(rowsFor(s.points))
          if (stat.median <= 0 || !stat.fromDate || !stat.toDate) continue
          const valueLabel = refIsEuro
            ? formatEur(stat.median)
            : `${stat.median.toFixed(barDecimals)}${barSuffix}`
          lines.push({
            id: `${refMetric}-median-${s.locationId}`,
            kind: 'flat',
            value: stat.median,
            fromDate: stat.fromDate,
            toDate: stat.toDate,
            label: `${s.locationName}${prefix ? ` ${prefix}` : ''} med ${valueLabel}/${unit} · n=${stat.sampleCount}`,
            color: referenceLineColorForOverlay(locationColor(s.locationId), {
              euro: refIsEuro ? refMetric : undefined,
              average: 'median',
            }),
            dashArray: style.dashArray,
            strokeWidth: style.strokeWidth,
            yAxis,
          })
        }
      }

      if (avg === 'rolling') {
        for (const windowLabel of rollingWindowLabels) {
          if (!activeRolling.value.has(windowLabel)) continue
          const days = STAFF_ROLLING_WINDOW_DAYS[windowLabel]!

          for (const s of series) {
            const points = chartRollingMedianSeries(
              rowsFor(s.points),
              chartGranularity.value,
              days,
            )
            const last = [...points].reverse().find((p) => p.value > 0)
            if (!last) continue
            const valueLabel = refIsEuro
              ? formatEur(last.value)
              : `${last.value.toFixed(barDecimals)}${barSuffix}`
            lines.push({
              id: `${refMetric}-${windowLabel}-${s.locationId}`,
              kind: 'series',
              points,
              label: `${s.locationName}${prefix ? ` ${prefix}` : ''} ${windowLabel} ${valueLabel}`,
              color: referenceLineColorForOverlay(locationColor(s.locationId), {
                euro: refIsEuro ? refMetric : undefined,
                average: 'rolling',
              }),
              dashArray: style.dashArray,
              strokeWidth: style.strokeWidth,
              strokeLinecap: 'strokeLinecap' in style ? style.strokeLinecap : undefined,
              yAxis,
            })
          }
        }
      }
    }
  }

  return lines
})

function toggleReferenceMetric(metric: ReferenceMetric) {
  const next = new Set(activeReferenceMetrics.value)
  if (next.has(metric)) next.delete(metric)
  else next.add(metric)
  activeReferenceMetrics.value = next
}

function toggleAverage(avg: AverageType) {
  const next = new Set(activeAverages.value)
  if (next.has(avg)) next.delete(avg)
  else next.add(avg)
  activeAverages.value = next
}

function toggleRolling(label: string) {
  const next = new Set(activeRolling.value)
  if (next.has(label)) next.delete(label)
  else next.add(label)
  activeRolling.value = next
}

function toggleTeam(groupKey: StaffTeamGroupKey) {
  const next = new Set(activeTeams.value)
  if (next.has(groupKey)) {
    if (next.size <= 1) return
    next.delete(groupKey)
  } else {
    next.add(groupKey)
  }
  activeTeams.value = next
}

function formatTeamSegmentValue(value: number): string {
  if (teamStackDisplay.value === 'percent') {
    return `${Math.round(value)}%`
  }
  return formatMetricValue(value)
}

function teamPillStyle(groupKey: StaffTeamGroupKey): Record<string, string> {
  const color = staffTeamGroupColor(groupKey)
  if (activeTeams.value.has(groupKey)) {
    return {
      backgroundColor: color,
      borderColor: color,
    }
  }
  return {
    backgroundColor: '#ffffff',
    borderColor: color,
    color,
  }
}

function metricValue(p: DailyOpsStaffTimeseriesPoint): number {
  if (activeMetric.value === 'hours') return p.gewerkt_hours
  if (activeMetric.value === 'staff') return p.staff_count
  return p.labor_loaded_cost ?? 0
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
  if (activeMetric.value === 'hours') return fmtHours(n)
  if (activeMetric.value === 'costs') return formatEur(n)
  return fmtCount(n)
}

const chartMetricHeading = computed(() => {
  if (activeMetric.value === 'hours') return `Hours worked (${chartGranularityLabel.value})`
  if (activeMetric.value === 'staff') return `Staff count (${chartGranularityLabel.value})`
  return `Labor costs (${chartGranularityLabel.value})`
})

const chartMetricNoun = computed(() => {
  if (activeMetric.value === 'hours') return 'hours'
  if (activeMetric.value === 'staff') return 'staff'
  return 'loaded labor cost'
})

const chartMetricShortLabel = computed(() => {
  if (activeMetric.value === 'hours') return 'Hours'
  if (activeMetric.value === 'staff') return 'Staff'
  return 'Labor costs'
})

function formatBarValue(n: number) {
  return formatMetricValue(n)
}

function locationColor(locationId: string): string {
  const fromApi = locationsRes.value?.data?.find((l) => l._id === locationId)?.chartColor
  if (fromApi) return fromApi
  return FALLBACK_VENUE_COLORS[locationId] ?? '#6b7280'
}

const chartTitle = computed(() => {
  if (graphType.value === 'stacked') {
    const venue =
      venueFilter.value === 'all'
        ? 'All venues'
        : (REVENUE_LOCATIONS.find((l) => l.id === venueFilter.value)?.abbrev ?? 'Venue')
    return `${chartMetricShortLabel.value} mix · ${venue}`
  }
  if (graphType.value === 'teams') {
    const venue =
      venueFilter.value === 'all'
        ? 'All venues'
        : (REVENUE_LOCATIONS.find((l) => l.id === venueFilter.value)?.abbrev ?? 'Venue')
    return `${chartMetricShortLabel.value} by team · ${venue}`
  }
  return chartMetricHeading.value.replace(/\s*\([^)]*\)$/, '')
})

function trendWindowLabel(mode: StaffNavMode): string {
  return STAFF_REFERENCE_WINDOWS.trend[mode]
}

function overlayLegendSuffix(): string {
  if (!activeAverages.value.size) return ''
  const longWin = trendWindowLabel(staffMode.value)
  const parts: string[] = []
  if (activeAverages.value.has('trend')) parts.push(`Solid total trend over ${longWin}`)
  if (activeAverages.value.has('median')) parts.push('dashed total median')
  if (activeAverages.value.has('rolling')) {
    const rolling = [...activeRolling.value].sort().join(', ') || '30d'
    parts.push(`dotted rolling ${rolling}`)
  }
  return parts.length ? `Overlay: ${parts.join(' · ')}.` : ''
}

const chartLegendText = computed(() => {
  if (viewMode.value !== 'chart') return ''

  if (graphType.value === 'stacked') {
    const metric =
      activeMetric.value === 'hours'
        ? 'hours'
        : activeMetric.value === 'staff'
          ? 'headcount'
          : 'loaded labor cost'
    const mix = `Stacked bars show FT / PT / ZZP share of ${metric} per period (% inside segments ≥6%).`
    const overlay = overlayLegendSuffix()
    return overlay ? `${mix} ${overlay}` : mix
  }

  if (graphType.value === 'teams') {
    const metric =
      activeMetric.value === 'hours'
        ? 'hours'
        : activeMetric.value === 'staff'
          ? 'active staff'
          : 'loaded labor cost'
    const contract =
      contractFilter.value === 'all' ? '' : ` · ${contractFilter.value.toUpperCase()} only`
    const mode =
      teamStackDisplay.value === 'percent'
        ? 'Bars normalised to 100% — allocation mix per period.'
        : activeMetric.value === 'staff'
          ? 'Absolute = unique people active in that period.'
          : activeMetric.value === 'costs'
            ? 'Absolute = loaded labor cost per team.'
            : 'Absolute = total hours per team.'
    const overlay = teamStackDisplay.value === 'absolute' ? overlayLegendSuffix() : ''
    const avg = overlay ? ` ${overlay}` : ''
    return `Team chart (${metric}${contract}). ${mode}${avg}`
  }

  if (!activeReferenceMetrics.value.size || !activeAverages.value.size) {
    return 'Pick Reference (Hours / Revenue / Costs) and Averages (Trend / Median / Rolling) to overlay lines.'
  }

  const longWin = trendWindowLabel(staffMode.value)
  const parts: string[] = []

  if (activeAverages.value.has('trend')) {
    parts.push(`Solid trend over ${longWin}`)
  }
  if (activeAverages.value.has('median')) {
    parts.push('Dashed median')
  }
  if (activeAverages.value.has('rolling')) {
    const rolling = [...activeRolling.value].sort().join(', ') || '30d'
    parts.push(`Dotted rolling ${rolling}`)
  }

  const refs = [...activeReferenceMetrics.value].map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(' + ')
  const axisHint = activeMetric.value === 'costs'
    ? 'Hours/staff overlays use right axis; revenue/costs share the € bar scale.'
    : 'Revenue/costs use right € axis; hours/staff use left axis.'
  return `${refs} · ${parts.join(' · ')}. ${axisHint}`
})
</script>
