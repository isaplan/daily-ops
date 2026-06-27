<template>
  <div ref="scrollRef" class="w-full h-full min-h-[300px] overflow-x-auto">
    <svg ref="svgRef" :width="svgWidth" :height="height" class="font-sans"></svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import * as d3 from 'd3'
import type { StaffChartGranularity } from '~/utils/dailyOpsStaffNav/modes'
import { formatStaffChartBucketLabel } from '~/utils/dailyOpsStaffChartLabels'

export type GroupedBarDataPoint = {
  date: string
  [key: string]: number | string
}

export type GroupedBarSeries = {
  key: string
  label: string
  color: string
}

export type GroupedBarReferenceLine =
  | {
      id: string
      label: string
      kind: 'flat'
      value: number
      fromDate?: string
      toDate?: string
      color?: string
      dashArray?: string
      strokeWidth?: number
    }
  | {
      id: string
      label: string
      kind: 'series'
      points: Array<{ date: string; value: number }>
      color?: string
      dashArray?: string
      strokeWidth?: number
    }

const props = withDefaults(
  defineProps<{
    data: GroupedBarDataPoint[]
    series: GroupedBarSeries[]
    referenceLines?: GroupedBarReferenceLine[]
    dateGranularity?: StaffChartGranularity
    width?: number
    height?: number
    margin?: { top: number; right: number; bottom: number; left: number }
  }>(),
  {
    width: 800,
    height: 400,
    referenceLines: () => [],
    dateGranularity: 'week',
    margin: () => ({ top: 28, right: 30, bottom: 52, left: 56 }),
  },
)

const svgRef = ref<SVGSVGElement | null>(null)
const scrollRef = ref<HTMLDivElement | null>(null)

const svgWidth = computed(() =>
  Math.max(props.data.length * (props.series.length * 18 + 24), props.width),
)

function refValues(): number[] {
  const vals: number[] = []
  for (const ref of props.referenceLines) {
    if (ref.kind === 'flat') vals.push(ref.value)
    else vals.push(...ref.points.map((p) => p.value))
  }
  return vals
}

function createChart() {
  if (!svgRef.value || !props.data.length || !props.series.length) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const innerWidth = svgWidth.value - props.margin.left - props.margin.right
  const innerHeight = props.height - props.margin.top - props.margin.bottom

  const x0 = d3
    .scaleBand()
    .domain(props.data.map((d) => d.date))
    .range([0, innerWidth])
    .padding(0.2)

  const x1 = d3
    .scaleBand()
    .domain(props.series.map((s) => s.key))
    .range([0, x0.bandwidth()])
    .padding(0.08)

  const barMax =
    d3.max(props.data, (d) =>
      d3.max(props.series, (s) => Number(d[s.key]) || 0),
    ) ?? 0
  const refMax = d3.max(refValues()) ?? 0
  const yMax = Math.max(barMax, refMax)

  const yScale = d3
    .scaleLinear()
    .domain([0, yMax > 0 ? yMax : 1])
    .nice()
    .range([innerHeight, 0])

  const g = svg
    .append('g')
    .attr('transform', `translate(${props.margin.left},${props.margin.top})`)

  const bucketCenter = (date: string) => (x0(date) ?? 0) + x0.bandwidth() / 2

  const grid = g.append('g').attr('class', 'reference-grid')
  for (const ref of props.referenceLines) {
    const stroke = ref.color ?? '#9ca3af'
    const dash = ref.dashArray
    const sw = ref.strokeWidth ?? 2

    const applyStrokeDash = (
      sel: d3.Selection<d3.BaseType, unknown, d3.BaseType, unknown>,
    ) => {
      if (dash) sel.attr('stroke-dasharray', dash)
      else sel.attr('stroke-dasharray', null)
    }

    if (ref.kind === 'flat' && ref.value > 0) {
      const band = x0.bandwidth()
      const xStart =
        ref.fromDate && x0(ref.fromDate) != null ? (x0(ref.fromDate) ?? 0) : 0
      const xEnd =
        ref.toDate && x0(ref.toDate) != null
          ? (x0(ref.toDate) ?? 0) + band
          : innerWidth

      applyStrokeDash(
        grid.append('line')
          .attr('x1', xStart)
          .attr('x2', xEnd)
          .attr('y1', yScale(ref.value))
          .attr('y2', yScale(ref.value))
          .attr('stroke', stroke)
          .attr('stroke-width', sw)
          .attr('opacity', 0.95),
      )
      grid.append('text')
        .attr('x', xEnd - 4)
        .attr('y', yScale(ref.value) - 5)
        .attr('text-anchor', 'end')
        .attr('class', 'text-[10px] font-semibold')
        .attr('fill', stroke)
        .attr('paint-order', 'stroke')
        .attr('stroke', 'white')
        .attr('stroke-width', 3)
        .text(ref.label)
    }

    if (ref.kind === 'series' && ref.points.length > 1) {
      const line = d3
        .line<{ date: string; value: number }>()
        .defined((p) => p.value > 0 && x0(p.date) != null)
        .x((p) => bucketCenter(p.date))
        .y((p) => yScale(p.value))

      applyStrokeDash(
        grid.append('path')
          .datum(ref.points)
          .attr('fill', 'none')
          .attr('stroke', stroke)
          .attr('stroke-width', sw)
          .attr('opacity', 0.95)
          .attr('d', line),
      )

      const last = [...ref.points].reverse().find((p) => p.value > 0)
      if (last) {
        grid.append('text')
          .attr('x', bucketCenter(last.date))
          .attr('y', yScale(last.value) - 5)
          .attr('text-anchor', 'middle')
          .attr('class', 'text-[10px] font-semibold')
          .attr('fill', stroke)
          .attr('paint-order', 'stroke')
          .attr('stroke', 'white')
          .attr('stroke-width', 3)
          .text(ref.label)
      }
    }
  }

  for (const row of props.data) {
    const gx = g
      .append('g')
      .attr('transform', `translate(${x0(row.date) ?? 0},0)`)

    for (const s of props.series) {
      const val = Number(row[s.key]) || 0
      gx.append('rect')
        .attr('x', x1(s.key) ?? 0)
        .attr('y', yScale(val))
        .attr('width', x1.bandwidth())
        .attr('height', innerHeight - yScale(val))
        .attr('fill', s.color)
        .attr('rx', 2)
        .attr('class', 'transition-opacity hover:opacity-80')
    }
  }

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(x0)
        .tickFormat((d) => formatStaffChartBucketLabel(String(d), props.dateGranularity)),
    )
    .selectAll('text')
    .attr('class', 'text-[10px]')
    .attr('transform', 'rotate(-35)')
    .style('text-anchor', 'end')
    .attr('dx', '-0.4em')
    .attr('dy', '0.2em')

  g.append('g').call(d3.axisLeft(yScale).ticks(6)).attr('class', 'text-xs')

  const legend = g.append('g').attr('transform', `translate(0,${-10})`)
  props.series.forEach((s, i) => {
    const lx = i * 90
    legend
      .append('rect')
      .attr('x', lx)
      .attr('y', -10)
      .attr('width', 10)
      .attr('height', 10)
      .attr('fill', s.color)
      .attr('rx', 1)
    legend
      .append('text')
      .attr('x', lx + 14)
      .attr('y', -1)
      .attr('class', 'text-xs fill-gray-700')
      .text(s.label)
  })

  scrollToLatest()
}

function scrollToLatest() {
  nextTick(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.value
      if (!el) return
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
    })
  })
}

onMounted(createChart)
watch(
  () => [props.data, props.series, props.referenceLines, props.width, props.height, props.dateGranularity],
  createChart,
  { deep: true },
)
</script>
