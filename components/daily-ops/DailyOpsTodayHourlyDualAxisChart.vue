<template>
  <div class="rounded border border-gray-200 bg-white p-3">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-600">
      <span class="font-semibold uppercase tracking-wide text-gray-500">
        Hourly · {{ basisLabel }} (calendar hour)
      </span>
      <div class="flex flex-wrap gap-x-4 gap-y-1">
        <span
          v-if="showRevenueLegend"
          class="inline-flex items-center gap-1"
        >
          <span class="h-0.5 w-4 bg-gray-900" /> Revenue (left)
        </span>
        <span
          v-if="showProductivityLegend"
          class="inline-flex items-center gap-1"
        >
          <span class="h-0.5 w-4 border-t border-dashed border-gray-900" /> €/labor h (right)
        </span>
      </div>
    </div>
    <div ref="chartWrapEl" class="min-w-0">
      <svg
        v-if="activeHours.length > 0 && chartSeries.length > 0"
        ref="svgRef"
        viewBox="0 0 760 300"
        role="img"
        aria-label="Hourly revenue and labor productivity by venue"
        class="block aspect-[760/300] w-full max-h-72 min-h-44"
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
    <div
      v-if="legendItems.length"
      class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-700"
    >
      <span
        v-for="item in legendItems"
        :key="item.id"
        class="inline-flex items-center gap-1.5"
      >
        <span
          class="inline-block h-0.5 w-4"
          :class="item.dashed ? 'border-t border-dashed' : ''"
          :style="item.dashed ? { borderColor: item.color } : { backgroundColor: item.color }"
        />
        {{ item.label }}
      </span>
    </div>
    <p
      v-if="activeHours.length === 0"
      class="py-8 text-center text-sm text-gray-500"
    >
      No hourly revenue or labor productivity data for the selected venues.
    </p>
  </div>
</template>

<script setup lang="ts">
import * as d3 from 'd3'
import type { DailyOpsHourlyRevenueLocationDto, DailyOpsHourlyRevenueRowDto } from '~/types/daily-ops-dashboard'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'

const { chartColorFor } = useDailyOpsLocationChartColors()

const props = defineProps<{
  rows: DailyOpsHourlyRevenueRowDto[]
  locationFilter: string
  metricFilter: 'all' | 'revenue' | 'productivity'
  basisLabel: string
}>()

type ChartPoint = { hour: number; hourLabel: string; value: number }
type ChartSeries = {
  id: string
  label: string
  color: string
  dashed: boolean
  axis: 'left' | 'right'
  points: ChartPoint[]
}

const svgRef = ref<SVGSVGElement | null>(null)
const chartWrapEl = ref<HTMLElement | null>(null)
const chartWidth = ref(760)

let chartResizeObserver: ResizeObserver | undefined

function measureChartWidth (): void {
  chartWidth.value = chartWrapEl.value?.clientWidth ?? 760
}

onMounted(() => {
  measureChartWidth()
  if (typeof ResizeObserver === 'undefined' || !chartWrapEl.value) return
  chartResizeObserver = new ResizeObserver(measureChartWidth)
  chartResizeObserver.observe(chartWrapEl.value)
})

onUnmounted(() => {
  chartResizeObserver?.disconnect()
})

const margin = { top: 12, right: 52, bottom: 48, left: 52 }
const width = 760
const height = 300

const visibleLocations = computed(() => {
  if (props.locationFilter === 'all') return DAILY_OPS_PROFIT_VENUE_LOCATIONS
  return DAILY_OPS_PROFIT_VENUE_LOCATIONS.filter(
    (location) => location.locationId === props.locationFilter,
  )
})

const showRevenueLegend = computed(() => props.metricFilter !== 'productivity')
const showProductivityLegend = computed(() => props.metricFilter !== 'revenue')

function emptyLocationMetric(locationId: string): DailyOpsHourlyRevenueLocationDto {
  return {
    locationId,
    locationName: '',
    revenue: 0,
    laborHours: 0,
    revenuePerLaborHour: null,
  }
}

function getLocationMetric(row: DailyOpsHourlyRevenueRowDto, locationId: string): DailyOpsHourlyRevenueLocationDto {
  return row.locations.find((location) => location.locationId === locationId) ?? emptyLocationMetric(locationId)
}

function locationMetricVisible(metric: DailyOpsHourlyRevenueLocationDto): boolean {
  if (props.metricFilter === 'revenue') return metric.revenue > 0
  if (props.metricFilter === 'productivity') {
    return metric.revenuePerLaborHour != null && Number.isFinite(metric.revenuePerLaborHour)
  }
  return (
    metric.revenue > 0
    || metric.laborHours > 0
    || (metric.revenuePerLaborHour != null && Number.isFinite(metric.revenuePerLaborHour))
  )
}

function hourHasData(row: DailyOpsHourlyRevenueRowDto): boolean {
  return visibleLocations.value.some((location: (typeof DAILY_OPS_PROFIT_VENUE_LOCATIONS)[number]) => {
    const metric = getLocationMetric(row, location.locationId)
    return locationMetricVisible(metric)
  })
}

const activeHours = computed((): number[] =>
  props.rows
    .filter(hourHasData)
    .map((row: DailyOpsHourlyRevenueRowDto) => row.calendarHour)
    .sort((a: number, b: number) => a - b),
)

const chartSeries = computed((): ChartSeries[] => {
  const hours = activeHours.value
  if (hours.length === 0) return []

  const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`
  const series: ChartSeries[] = []

  for (const location of visibleLocations.value) {
    const color = chartColorFor(location.locationId)
    const revenuePoints: ChartPoint[] = []
    const productivityPoints: ChartPoint[] = []

    for (const hour of hours) {
      const row = props.rows.find((entry: DailyOpsHourlyRevenueRowDto) => entry.calendarHour === hour)
      if (!row) continue
      const metric = getLocationMetric(row, location.locationId)
      const label = hourLabel(hour)
      if (metric.revenue > 0) {
        revenuePoints.push({ hour, hourLabel: label, value: metric.revenue })
      }
      if (metric.revenuePerLaborHour != null && Number.isFinite(metric.revenuePerLaborHour)) {
        productivityPoints.push({
          hour,
          hourLabel: label,
          value: metric.revenuePerLaborHour,
        })
      }
    }

    if (revenuePoints.length > 0 && props.metricFilter !== 'productivity') {
      series.push({
        id: `${location.locationId}-revenue`,
        label: `${location.short} revenue`,
        color,
        dashed: false,
        axis: 'left',
        points: revenuePoints,
      })
    }
    if (productivityPoints.length > 0 && props.metricFilter !== 'revenue') {
      series.push({
        id: `${location.locationId}-productivity`,
        label: `${location.short} €/h`,
        color,
        dashed: true,
        axis: 'right',
        points: productivityPoints,
      })
    }
  }

  return series
})

const legendItems = computed(() =>
  chartSeries.value.map((entry: ChartSeries) => ({
    id: entry.id,
    label: entry.label,
    color: entry.color,
    dashed: entry.dashed,
  })),
)

function formatLeftTick(value: d3.NumberValue): string {
  const n = Number(value)
  if (n >= 1000) return `€${Math.round(n / 1000)}k`
  return `€${Math.round(n)}`
}

function formatRightTick(value: d3.NumberValue): string {
  const n = Number(value)
  if (n >= 1000) return `€${Math.round(n / 1000)}k`
  return `€${Math.round(n)}`
}

function axisFontSize (): number {
  return chartWidth.value < 640 ? 14 : 13
}

function xTickLabelsForWidth(hourLabels: string[]): string[] {
  const w = chartWidth.value
  if (w >= 1024 || hourLabels.length <= 8) return hourLabels
  if (w >= 640) {
    return hourLabels.filter((_: string, index: number) => index % 2 === 0 || index === hourLabels.length - 1)
  }
  if (w >= 400) {
    return hourLabels.filter((_: string, index: number) => index % 3 === 0 || index === hourLabels.length - 1)
  }
  const keep = new Set([0, Math.floor(hourLabels.length / 2), hourLabels.length - 1])
  return hourLabels.filter((_: string, index: number) => keep.has(index))
}

function styleAxisText(selection: d3.Selection<SVGTextElement, unknown, null, undefined>): void {
  selection
    .attr('font-size', axisFontSize())
    .attr('fill', '#111827')
    .attr('font-weight', '600')
}

function drawChart() {
  if (!svgRef.value) return
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const hours = activeHours.value
  const series = chartSeries.value
  if (hours.length === 0 || series.length === 0) return

  const hourLabels = hours.map((hour: number) => `${String(hour).padStart(2, '0')}:00`)
  const xTickLabels = xTickLabelsForWidth(hourLabels)
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const leftMax = d3.max(
    series.filter((entry: ChartSeries) => entry.axis === 'left'),
    (entry: ChartSeries) => d3.max(entry.points, (point: ChartPoint) => point.value) ?? 0,
  ) ?? 0
  const rightMax = d3.max(
    series.filter((entry: ChartSeries) => entry.axis === 'right'),
    (entry: ChartSeries) => d3.max(entry.points, (point: ChartPoint) => point.value) ?? 0,
  ) ?? 0

  const x = d3.scalePoint<string>().domain(hourLabels).range([0, innerW]).padding(0.15)
  const yLeft = d3.scaleLinear().domain([0, leftMax * 1.08 || 1]).range([innerH, 0])
  const yRight = d3.scaleLinear().domain([0, rightMax * 1.08 || 1]).range([innerH, 0])

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickValues(xTickLabels))
    .call((axis: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      styleAxisText(axis.selectAll<SVGTextElement, unknown>('text'))
    })

  if (series.some((entry: ChartSeries) => entry.axis === 'left')) {
    g.append('g')
      .call(d3.axisLeft(yLeft).ticks(5).tickFormat(formatLeftTick))
      .call((axis: d3.Selection<SVGGElement, unknown, null, undefined>) => {
        styleAxisText(axis.selectAll<SVGTextElement, unknown>('text'))
      })
  }

  if (series.some((entry: ChartSeries) => entry.axis === 'right')) {
    g.append('g')
      .attr('transform', `translate(${innerW},0)`)
      .call(d3.axisRight(yRight).ticks(5).tickFormat(formatRightTick))
      .call((axis: d3.Selection<SVGGElement, unknown, null, undefined>) => {
        styleAxisText(axis.selectAll<SVGTextElement, unknown>('text'))
      })
  }

  const line = d3
    .line<ChartPoint>()
    .defined((point: ChartPoint) => Number.isFinite(point.value))
    .x((point: ChartPoint) => x(point.hourLabel) ?? 0)

  for (const entry of series) {
    const yScale = entry.axis === 'right' ? yRight : yLeft
    const pathLine = line.y((point: ChartPoint) => yScale(point.value))

    g.append('path')
      .datum(entry.points)
      .attr('fill', 'none')
      .attr('stroke', entry.color)
      .attr('stroke-width', entry.dashed ? 2 : 2.5)
      .attr('stroke-dasharray', entry.dashed ? '6 4' : null)
      .attr('d', pathLine)
  }
}

watch([chartSeries, activeHours, () => props.metricFilter, chartWidth], async () => {
  await nextTick()
  drawChart()
}, { deep: true, immediate: true })
</script>
