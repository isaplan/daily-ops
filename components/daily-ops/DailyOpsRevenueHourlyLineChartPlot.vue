<template>
  <svg
    viewBox="0 0 720 252"
    role="img"
    aria-label="Hourly revenue line chart"
    :class="svgClass"
    preserveAspectRatio="xMidYMid meet"
  >
    <line x1="36" y1="184" x2="700" y2="184" stroke="#E5E7EB" stroke-width="1" />
    <line x1="36" y1="24" x2="36" y2="184" stroke="#E5E7EB" stroke-width="1" />
    <g
      v-for="tick in xAxisTicks"
      :key="tick.hour"
    >
      <line :x1="tick.x" y1="184" :x2="tick.x" y2="190" stroke="#D1D5DB" stroke-width="1" />
      <text
        :x="tick.x"
        y="212"
        text-anchor="middle"
        fill="#111827"
        :font-size="typography.axisFont"
        font-weight="600"
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
        :r="typography.dotRadius"
        :fill="point.color"
      />
      <text
        v-if="point.showLabel"
        :x="point.x"
        :y="point.labelY"
        text-anchor="middle"
        fill="#111827"
        :font-size="typography.dotFont"
        font-weight="700"
      >
        {{ point.label }}
      </text>
    </g>
    <text
      x="40"
      y="28"
      fill="#111827"
      :font-size="typography.axisFont"
      font-weight="600"
    >
      {{ formatCompact(maxValue) }}
    </text>
    <g v-if="hasRevenueRows && !hasActiveBenchmark">
      <rect x="190" y="84" width="340" height="42" rx="8" fill="#F9FAFB" stroke="#D1D5DB" />
      <text
        x="360"
        y="103"
        text-anchor="middle"
        fill="#374151"
        font-size="12"
        font-weight="600"
      >
        Median unavailable for active hours
      </text>
      <text
        x="360"
        y="119"
        text-anchor="middle"
        fill="#374151"
        font-size="11"
      >
        Historical same-weekday snapshot rows are missing for these hours.
      </text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import type { DailyOpsRevenueDrilldownHourlyRowDto } from '~/types/daily-ops-dashboard'

const props = withDefaults(
  defineProps<{
    rows: DailyOpsRevenueDrilldownHourlyRowDto[]
    multiDay?: boolean
    containerWidth?: number
    svgClass?: string
    expanded?: boolean
  }>(),
  {
    containerWidth: 720,
    svgClass: 'block aspect-[3/1] w-full max-h-72 min-h-44',
    expanded: false,
  },
)

type ChartDot = {
  key: number
  x: number
  y: number
  labelY: number
  color: string
  label: string
  showLabel: boolean
}

type AxisTick = {
  hour: number
  label: string
  x: number
}

type ChartTypography = {
  axisFont: number
  dotFont: number
  dotRadius: number
  xAxisHours: number[]
}

const GRAPH_AXIS_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3] as const
const GRAPH_AXIS_HOUR_SET = new Set<number>(GRAPH_AXIS_HOURS)

const typography = computed((): ChartTypography => {
  if (props.expanded) {
    return {
      axisFont: 14,
      dotFont: 13,
      dotRadius: 5,
      xAxisHours: [11, 13, 15, 17, 19, 21, 23, 1, 3],
    }
  }

  const w = props.containerWidth
  if (w < 400) {
    return {
      axisFont: 15,
      dotFont: 14,
      dotRadius: 4,
      xAxisHours: [11, 17, 23, 3],
    }
  }
  if (w < 640) {
    return {
      axisFont: 14,
      dotFont: 13,
      dotRadius: 4,
      xAxisHours: [11, 15, 19, 23, 3],
    }
  }
  if (w < 1024) {
    return {
      axisFont: 13,
      dotFont: 12,
      dotRadius: 4,
      xAxisHours: [11, 13, 17, 21, 1, 3],
    }
  }
  return {
    axisFont: 13,
    dotFont: 12,
    dotRadius: 4,
    xAxisHours: [11, 13, 15, 17, 19, 21, 23, 1, 3],
  }
})

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

const xAxisTicks = computed<AxisTick[]>(() =>
  typography.value.xAxisHours
    .filter((hour: number) => isVisibleBusinessAxisHour(hour))
    .map((hour: number) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      x: pointXForHour(hour),
    })),
)

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

const revenueDots = computed<ChartDot[]>(() => {
  const dots = chartRows.value.map((row: DailyOpsRevenueDrilldownHourlyRowDto) => ({
    key: row.calendarHour,
    x: pointXForHour(row.calendarHour),
    y: pointY(row.revenue),
    labelY: Math.max(16, pointY(row.revenue) - 12),
    color: row.benchmarkStatus === 'below' ? '#C97B7B' : row.benchmarkStatus === 'above' ? '#5B9A6F' : '#111827',
    label: formatCompact(row.revenue),
    showLabel: row.revenue > 0,
  }))
  const labelOffsetByIndex = new Map<number, number>()
  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i]
    if (!dot.showLabel) continue
    let offset = 0
    for (let j = 0; j < i; j++) {
      const prev = dots[j]
      if (!prev.showLabel) continue
      if (Math.abs(prev.x - dot.x) < 28 && Math.abs(prev.labelY + (labelOffsetByIndex.get(j) ?? 0) - dot.labelY) < 14) {
        offset -= 14
      }
    }
    labelOffsetByIndex.set(i, offset)
    dot.labelY += offset
  }
  return dots
})

function formatCompact(value: number): string {
  if (value >= 1000) return `€${Math.round(value / 1000)}k`
  return `€${Math.round(value)}`
}
</script>
