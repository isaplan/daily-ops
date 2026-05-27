<template>
  <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Hourly Revenue</h3>
        <p class="text-xs text-gray-500">{{ subtitle }}</p>
      </div>
      <div class="flex gap-3 text-xs text-gray-600">
        <span class="inline-flex items-center gap-1.5">
          <span class="h-0.5 w-5 bg-gray-900" />
          Current
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="h-0.5 w-5 bg-gray-400" />
          Median
        </span>
      </div>
    </div>

    <svg
      viewBox="0 0 720 240"
      role="img"
      aria-label="Hourly revenue line chart"
      class="h-72 w-full"
      preserveAspectRatio="none"
    >
      <line x1="36" y1="184" x2="700" y2="184" stroke="#E5E7EB" stroke-width="1" />
      <line x1="36" y1="24" x2="36" y2="184" stroke="#E5E7EB" stroke-width="1" />
      <g
        v-for="tick in xAxisTicks"
        :key="tick.hour"
        class="text-[10px] fill-gray-500"
      >
        <line :x1="tick.x" y1="184" :x2="tick.x" y2="190" stroke="#D1D5DB" stroke-width="1" />
        <text
          :x="tick.x"
          y="208"
          text-anchor="middle"
        >
          {{ tick.label }}
        </text>
      </g>
      <polyline
        v-if="benchmarkPoints"
        :points="benchmarkPoints"
        fill="none"
        stroke="#9CA3AF"
        stroke-width="2"
        stroke-dasharray="5 5"
      />
      <polyline
        v-if="revenuePoints"
        :points="revenuePoints"
        fill="none"
        stroke="#111827"
        stroke-width="3"
      />
      <g
        v-for="point in revenueDots"
        :key="point.key"
      >
        <circle
          :cx="point.x"
          :cy="point.y"
          r="4"
          :fill="point.color"
        />
        <text
          :x="point.x"
          :y="point.labelY"
          text-anchor="middle"
          class="fill-gray-900 text-[10px] font-semibold"
        >
          {{ point.label }}
        </text>
      </g>
      <g class="text-[10px] fill-gray-500">
        <text x="4" y="28">{{ formatCompact(maxValue) }}</text>
      </g>
      <g v-if="hasRevenueRows && !hasActiveBenchmark">
        <rect x="190" y="84" width="340" height="42" rx="8" fill="#F9FAFB" stroke="#D1D5DB" />
        <text x="360" y="103" text-anchor="middle" class="fill-gray-600 text-[12px] font-semibold">
          Median unavailable for active hours
        </text>
        <text x="360" y="119" text-anchor="middle" class="fill-gray-500 text-[10px]">
          Historical same-weekday snapshot rows are missing for these hours.
        </text>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import type { DailyOpsRevenueDrilldownHourlyRowDto } from '~/types/daily-ops-dashboard'

const props = defineProps<{
  rows: DailyOpsRevenueDrilldownHourlyRowDto[]
}>()

type ChartDot = {
  key: number
  x: number
  y: number
  labelY: number
  color: string
  label: string
}

type AxisTick = {
  hour: number
  label: string
  x: number
}

const GRAPH_AXIS_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3] as const
const GRAPH_AXIS_HOUR_SET = new Set<number>(GRAPH_AXIS_HOURS)

function isVisibleBusinessAxisHour(hour: number): boolean {
  return GRAPH_AXIS_HOUR_SET.has(hour)
}

const chartRows = computed<DailyOpsRevenueDrilldownHourlyRowDto[]>(() =>
  props.rows
    .filter(
      (row: DailyOpsRevenueDrilldownHourlyRowDto) =>
        isVisibleBusinessAxisHour(row.calendarHour) &&
        (row.revenue > 0 || row.benchmarkRevenue != null),
    )
    .sort(
      (a: DailyOpsRevenueDrilldownHourlyRowDto, b: DailyOpsRevenueDrilldownHourlyRowDto) =>
        businessHourIndex(a.calendarHour) - businessHourIndex(b.calendarHour),
    ),
)
const hasRevenueRows = computed(() => props.rows.some((row: DailyOpsRevenueDrilldownHourlyRowDto) => row.revenue > 0))
const hasActiveBenchmark = computed(() =>
  props.rows.some((row: DailyOpsRevenueDrilldownHourlyRowDto) => row.revenue > 0 && row.benchmarkRevenue != null),
)
const subtitle = computed(() =>
  hasActiveBenchmark.value
    ? 'Current revenue against last 5 same-weekday median, shown for service hours 11:00 → 03:00.'
    : 'No median benchmark is available for the active revenue hours yet.',
)
const maxValue = computed(() => {
  const values = chartRows.value.flatMap((row: DailyOpsRevenueDrilldownHourlyRowDto) => [
    row.revenue,
    row.benchmarkRevenue ?? 0,
  ])
  return Math.max(1, ...values)
})

function businessHourIndex(hour: number): number {
  const index = GRAPH_AXIS_HOURS.indexOf(Math.min(23, Math.max(0, hour)) as (typeof GRAPH_AXIS_HOURS)[number])
  return index >= 0 ? index : 0
}

function pointXForHour(hour: number): number {
  return 36 + (businessHourIndex(hour) / Math.max(1, GRAPH_AXIS_HOURS.length - 1)) * 664
}

function pointY(value: number): number {
  return 184 - (value / maxValue.value) * 160
}

const xAxisTicks = computed<AxisTick[]>(() => {
  const hours = [11, 13, 15, 17, 19, 21, 23, 1, 3]
  return hours
    .filter((hour: number) => isVisibleBusinessAxisHour(hour))
    .map((hour: number) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      x: pointXForHour(hour),
    }))
})

const revenuePoints = computed(() =>
  chartRows.value.length > 0
    ? chartRows.value
        .map(
          (row: DailyOpsRevenueDrilldownHourlyRowDto) =>
            `${pointXForHour(row.calendarHour)},${pointY(row.revenue)}`,
        )
        .join(' ')
    : '',
)

const benchmarkPoints = computed(() => {
  const points = chartRows.value
    .map((row: DailyOpsRevenueDrilldownHourlyRowDto) =>
      row.benchmarkRevenue == null ? null : `${pointXForHour(row.calendarHour)},${pointY(row.benchmarkRevenue)}`,
    )
    .filter((point: string | null): point is string => point != null)
  return points.length > 1 ? points.join(' ') : ''
})

const revenueDots = computed<ChartDot[]>(() =>
  chartRows.value.map((row: DailyOpsRevenueDrilldownHourlyRowDto) => ({
    key: row.calendarHour,
    x: pointXForHour(row.calendarHour),
    y: pointY(row.revenue),
    labelY: Math.max(14, pointY(row.revenue) - 10),
    color: row.benchmarkStatus === 'below' ? '#C97B7B' : row.benchmarkStatus === 'above' ? '#5B9A6F' : '#111827',
    label: formatCompact(row.revenue),
  })),
)

function formatCompact(value: number): string {
  if (value >= 1000) return `€${Math.round(value / 1000)}k`
  return `€${Math.round(value)}`
}
</script>
