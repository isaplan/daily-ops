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

        <div v-if="showAverageControls" class="flex flex-col gap-2">
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
            :key="`${breakdown.granularity}-${chartData.length}-${visibleSeries.map((s) => s.key).join(',')}`"
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
/**
 * @last-modified: 2026-07-16T00:00:00.000Z
 * @last-fix: [2026-07-16] Remount D3 chart on granularity change to reset x-axis
 */
import D3GroupedBarChart from '~/components/charts/D3GroupedBarChart.vue'
import D3StackedBarChart from '~/components/charts/D3StackedBarChart.vue'
import type { GroupedBarReferenceLine, GroupedBarSeries } from '~/components/charts/D3GroupedBarChart.vue'
import type { StackedBarDataPoint } from '~/components/charts/D3StackedBarChart.vue'
import type { PeriodBreakdownDto, PeriodBreakdownGranularity, PeriodBreakdownRowDto } from '~/types/daily-ops-dashboard'
import type { StaffContractBucketKey } from '~/utils/dailyOpsStaffContractBuckets'
import { referenceLineColor, referenceLineColorForOverlay, referenceLineStyleForAverage } from '~/utils/chartReferenceColor'
import { chartPeriodMedian, chartTrendSeriesProjected } from '~/utils/dailyOpsStaffChartMedians'
import {
  PERIOD_HOUR_OVERLAY_LOOKBACK_DAYS,
  PERIOD_ROLLING_BUCKETS,
  PERIOD_TREND_BUCKETS,
  chartHourTrendProjected,
  chartRollingMedianByBuckets,
  periodRollingWindowLabel,
  periodTrendWindowLabel,
} from '~/utils/dailyOpsPeriodBreakdownAverages'
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

const averageOptions = [
  { id: 'trend' as const, label: 'Trend' },
  { id: 'median' as const, label: 'Median' },
  { id: 'rolling' as const, label: 'Rolling' },
]

type AverageType = (typeof averageOptions)[number]['id']

const activeAverages = ref(new Set<AverageType>(['trend']))
const activeRolling = ref(new Set<string>())

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

function rowsForVenue(locationId: string) {
  const venue = venueOptions.value.find((v) => v.locationId === locationId)
  let rows = venue?.rows ?? []
  if (props.breakdown.granularity === 'hour' && props.businessDate) {
    rows = filterHourRowsForVenues(rows, [locationId], props.businessDate)
  } else if (props.breakdown.granularity === 'month') {
    return rows
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

const rollingWindowLabels = computed(() =>
  PERIOD_ROLLING_BUCKETS[props.breakdown.granularity].map((b) =>
    periodRollingWindowLabel(props.breakdown.granularity, b),
  ),
)

watch(
  rollingWindowLabels,
  (labels) => {
    if (!labels.length) return
    const valid = [...activeRolling.value].filter((w) => labels.includes(w))
    activeRolling.value = new Set(valid.length ? valid : [labels[0]!])
  },
  { immediate: true },
)

const showAverageControls = computed(
  () =>
    !showStaffStacked.value
    && props.breakdown.granularity !== 'day'
    && !(props.breakdown.granularity === 'hour' && props.businessDate)
    && chartData.value.length > 0
    && (multiLocationMode.value || activeMetrics.value.size === 1),
)

function historyRowsForVenue(locationId: string): PeriodBreakdownRowDto[] {
  const historyVenue = props.breakdown.averageHistory?.byVenue.find((v) => v.locationId === locationId)
  if (historyVenue?.rows?.length) {
    return historyVenue.rows.filter(
      (r) => r.revenue > 0 || r.laborCost > 0 || r.profit !== 0 || r.staffCount > 0,
    )
  }
  return rowsForVenue(locationId)
}

function mapHourOverlayPoints(
  points: Array<{ date: string; value: number }>,
): Array<{ date: string; value: number }> {
  if (props.breakdown.granularity !== 'hour' || !props.businessDate) return points
  const prefix = `${props.businessDate}T`
  return points
    .filter((p) => p.date.startsWith(prefix))
    .map((p) => ({
      date: p.date.slice(prefix.length),
      value: p.value,
    }))
    .filter((p) => bucketKeys.value.includes(p.date))
}

function historyMetricSeries(locationId: string, metric: MetricKey) {
  return historyRowsForVenue(locationId)
    .map((row) => ({ date: row.bucketKey, value: metricValue(row, metric) }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => a.date.localeCompare(b.date, undefined, { numeric: true }))
}

function visibleMetricRows(locationId: string, metric: MetricKey) {
  const history = historyMetricSeries(locationId, metric)
  return bucketKeys.value.map((date) => ({
    date,
    value: history.find((h) => h.date === date)?.value
      ?? metricValue(rowsForVenue(locationId).find((r) => r.bucketKey === date), metric),
  }))
}

function granularityUnit(granularity: PeriodBreakdownGranularity): string {
  switch (granularity) {
    case 'hour':
      return 'hr'
    case 'day':
      return 'day'
    case 'week':
      return 'wk'
    case 'month':
      return 'mo'
  }
}

function formatOverlayValue(value: number, metric: MetricKey): string {
  const def = METRIC_DEFS.find((m) => m.key === metric)
  if (!def || !Number.isFinite(value)) return '—'
  if (def.scale === 'count') return String(Math.round(value))
  if (def.scale === 'eurPerHour') return formatPeriodBreakdownEurPerHour(value)
  return formatPeriodBreakdownMoney(value)
}

function medianHistoryLabel(): string {
  if (!props.breakdown.averageHistory) return 'on chart'
  if (props.breakdown.granularity === 'hour') return `last ${PERIOD_HOUR_OVERLAY_LOOKBACK_DAYS}d`
  return 'since 2024'
}

function buildOverlayLines(
  locationId: string,
  labelPrefix: string,
  color: string,
  metric: MetricKey,
  useVenueColor: boolean,
): GroupedBarReferenceLine[] {
  if (!activeAverages.value.size) return []

  const granularity = props.breakdown.granularity
  const unit = granularityUnit(granularity)
  const history = historyMetricSeries(locationId, metric)
  if (!history.length) return []

  const visible = visibleMetricRows(locationId, metric)
  const lines: GroupedBarReferenceLine[] = []

  if (activeAverages.value.has('trend')) {
    const trendWindow = history.slice(-PERIOD_TREND_BUCKETS[granularity])
    const trend =
      granularity === 'hour' && props.businessDate
        ? chartHourTrendProjected(visible, history, props.businessDate, PERIOD_TREND_BUCKETS.hour)
        : chartTrendSeriesProjected(visible, trendWindow)
    if (trend.points.length >= 2) {
      const slopeLabel = `${trend.slopePerBucket >= 0 ? '+' : ''}${formatOverlayValue(trend.slopePerBucket, metric)}/${unit}`
      const style = referenceLineStyleForAverage('trend')
      lines.push({
        id: `${locationId}-trend`,
        kind: 'series',
        points: granularity === 'hour' ? trend.points : mapHourOverlayPoints(trend.points),
        label: `${labelPrefix} ${slopeLabel} · ${periodTrendWindowLabel(granularity)} · n=${trend.sampleCount}`,
        color: useVenueColor
          ? referenceLineColorForOverlay(color, { average: 'trend' })
          : referenceLineColor(color, 'trend'),
        strokeWidth: style.strokeWidth,
        dashArray: style.dashArray,
        strokeLinecap: 'strokeLinecap' in style ? style.strokeLinecap : undefined,
      })
    }
  }

  if (activeAverages.value.has('median')) {
    const stat = chartPeriodMedian(history)
    if (Number.isFinite(stat.median)) {
      const style = referenceLineStyleForAverage('median')
      lines.push({
        id: `${locationId}-median`,
        kind: 'flat',
        value: stat.median,
        fromDate: stat.fromDate ?? undefined,
        toDate: stat.toDate ?? undefined,
        label: `${labelPrefix} med ${formatOverlayValue(stat.median, metric)}/${unit} · ${medianHistoryLabel()} · n=${stat.sampleCount}`,
        color: useVenueColor
          ? referenceLineColorForOverlay(color, { average: 'median' })
          : referenceLineColor(color, 'median'),
        strokeWidth: style.strokeWidth,
        dashArray: style.dashArray,
      })
    }
  }

  if (activeAverages.value.has('rolling')) {
    for (const windowLabel of rollingWindowLabels.value) {
      if (!activeRolling.value.has(windowLabel)) continue
      const buckets = PERIOD_ROLLING_BUCKETS[granularity].find(
        (b) => periodRollingWindowLabel(granularity, b) === windowLabel,
      )
      if (!buckets) continue
      const points = mapHourOverlayPoints(chartRollingMedianByBuckets(history, buckets))
      const last = [...points].reverse().find((p) => Number.isFinite(p.value))
      if (!last) continue
      const style = referenceLineStyleForAverage('rolling')
      lines.push({
        id: `${locationId}-${windowLabel}`,
        kind: 'series',
        points,
        label: `${labelPrefix} ${windowLabel} ${formatOverlayValue(last.value, metric)}`,
        color: useVenueColor
          ? referenceLineColorForOverlay(color, { average: 'rolling' })
          : referenceLineColor(color, 'rolling'),
        strokeWidth: style.strokeWidth,
        dashArray: style.dashArray,
        strokeLinecap: 'strokeLinecap' in style ? style.strokeLinecap : undefined,
      })
    }
  }

  return lines
}

function seriesMaxForNormalizedOverlay(seriesKey: string): number {
  const vals = chartData.value.map((d) => Number(d[seriesKey]) || 0)
  return Math.max(...vals, 1)
}

function scaleReferenceLinesForNormalizedScale(
  lines: GroupedBarReferenceLine[],
  seriesKey: string,
): GroupedBarReferenceLine[] {
  const max = seriesMaxForNormalizedOverlay(seriesKey)
  return lines.map((line) => {
    if (line.kind === 'flat' && line.value != null) {
      return { ...line, value: line.value / max }
    }
    if (line.kind === 'series' && line.points) {
      return {
        ...line,
        points: line.points.map((p) => ({ ...p, value: p.value / max })),
      }
    }
    return line
  })
}

const chartReferenceLines = computed((): GroupedBarReferenceLine[] => {
  if (!showAverageControls.value || !activeAverages.value.size) return []

  const metric = activeMetricKey.value
  const normalize = effectiveNormalizeScale.value

  if (multiLocationMode.value) {
    return visibleSeries.value.flatMap((s) => {
      const lines = buildOverlayLines(s.key, s.label, s.color, metric, true)
      return normalize ? scaleReferenceLinesForNormalizedScale(lines, s.key) : lines
    })
  }

  const locationId = [...activeLocationIds.value][0]
  const def = METRIC_DEFS.find((m) => m.key === metric)
  if (!locationId || !def) return []
  const lines = buildOverlayLines(locationId, def.label, def.color, metric, false)
  return normalize ? scaleReferenceLinesForNormalizedScale(lines, metric) : lines
})
</script>
