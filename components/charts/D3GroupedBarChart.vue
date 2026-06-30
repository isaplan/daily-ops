<template>
  <div class="flex w-full min-h-[300px]" :style="{ height: `${height}px` }">
    <svg
      v-if="showLeftAxis"
      ref="leftAxisRef"
      :width="margin.left"
      :height="height"
      class="shrink-0 bg-white font-sans"
      aria-hidden="true"
    />
    <div ref="scrollRef" class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
      <svg ref="plotRef" :width="plotWidth" :height="height" class="font-sans" />
    </div>
    <svg
      v-if="hasRightAxis"
      ref="rightAxisRef"
      :width="rightAxisWidth"
      :height="height"
      class="shrink-0 bg-white font-sans"
      aria-hidden="true"
    />
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
      yAxis?: 'left' | 'right'
      strokeLinecap?: 'butt' | 'round' | 'square'
    }
  | {
      id: string
      label: string
      kind: 'series'
      points: Array<{ date: string; value: number }>
      color?: string
      dashArray?: string
      strokeWidth?: number
      yAxis?: 'left' | 'right'
      strokeLinecap?: 'butt' | 'round' | 'square'
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
    showBars?: boolean
    formatBarValue?: (value: number) => string
  }>(),
  {
    width: 800,
    height: 400,
    referenceLines: () => [],
    dateGranularity: 'week',
    margin: () => ({ top: 28, right: 8, bottom: 52, left: 56 }),
    showBars: true,
    formatBarValue: undefined,
  },
)

const leftAxisRef = ref<SVGSVGElement | null>(null)
const plotRef = ref<SVGSVGElement | null>(null)
const rightAxisRef = ref<SVGSVGElement | null>(null)
const scrollRef = ref<HTMLDivElement | null>(null)

const rightAxisWidth = 56

const hasRightAxis = computed(() =>
  props.referenceLines.some((r) => r.yAxis === 'right'),
)

const showLeftAxis = computed(
  () => props.showBars || props.referenceLines.some((r) => r.yAxis !== 'right'),
)

const plotWidth = computed(() => {
  const axisW =
    (showLeftAxis.value ? props.margin.left : 0) +
    (hasRightAxis.value ? rightAxisWidth : 0)
  const minPlot = Math.max(
    props.data.length * (props.series.length * 18 + 24),
    props.width - axisW,
  )
  return minPlot
})

function refValues(lines: GroupedBarReferenceLine[]): number[] {
  const vals: number[] = []
  for (const ref of lines) {
    if (ref.kind === 'flat') vals.push(ref.value)
    else vals.push(...ref.points.map((p) => p.value))
  }
  return vals
}

function eurTick(v: d3.NumberValue): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  if (Math.abs(n) >= 1000) return `€${Math.round(n / 1000)}k`
  return `€${Math.round(n)}`
}

function defaultBarFormat(value: number): string {
  if (value >= 100) return String(Math.round(value))
  if (value >= 10) return value.toFixed(0)
  return value.toFixed(1)
}

function formatBar(value: number): string {
  return (props.formatBarValue ?? defaultBarFormat)(value)
}

function appendLabelBadge(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  x: number,
  y: number,
  text: string,
  anchor: 'start' | 'middle' | 'end',
) {
  const g = parent
    .append('g')
    .attr('class', 'ref-label-badge')
    .attr('transform', `translate(${x},${y})`)

  const textEl = g
    .append('text')
    .attr('text-anchor', anchor)
    .attr('dy', '-0.45em')
    .attr('class', 'text-[10px] font-semibold')
    .attr('fill', '#111827')
    .text(text)

  const node = textEl.node()
  if (!node) return

  const bbox = node.getBBox()
  const padX = 6
  const padY = 3
  g.insert('rect', 'text')
    .attr('x', bbox.x - padX)
    .attr('y', bbox.y - padY)
    .attr('width', bbox.width + padX * 2)
    .attr('height', bbox.height + padY * 2)
    .attr('rx', 5)
    .attr('fill', 'rgba(255,255,255,0.88)')
    .attr('stroke', 'rgba(17,24,39,0.12)')
}

function createChart() {
  if (!plotRef.value || !props.data.length || !props.series.length) return
  if (showLeftAxis.value && !leftAxisRef.value) return
  if (hasRightAxis.value && !rightAxisRef.value) return

  const innerHeight = props.height - props.margin.top - props.margin.bottom
  const plotInnerWidth = plotWidth.value

  const leftRefs = props.referenceLines.filter((r) => r.yAxis !== 'right')
  const rightRefs = props.referenceLines.filter((r) => r.yAxis === 'right')

  const x0 = d3
    .scaleBand()
    .domain(props.data.map((d) => d.date))
    .range([0, plotInnerWidth])
    .padding(0.2)

  const x1 = d3
    .scaleBand()
    .domain(props.series.map((s) => s.key))
    .range([0, x0.bandwidth()])
    .padding(0.08)

  const barMax = props.showBars
    ? d3.max(props.data, (d) => d3.max(props.series, (s) => Number(d[s.key]) || 0)) ?? 0
    : 0
  const leftRefMax = d3.max(refValues(leftRefs)) ?? 0
  const rightRefMax = d3.max(refValues(rightRefs)) ?? 0
  const yMax = Math.max(barMax, leftRefMax, 1)

  const yScale = d3
    .scaleLinear()
    .domain([0, yMax > 0 ? yMax : 1])
    .nice()
    .range([innerHeight, 0])

  const yScaleRight =
    hasRightAxis.value
      ? d3
          .scaleLinear()
          .domain([0, rightRefMax > 0 ? rightRefMax : 1])
          .nice()
          .range([innerHeight, 0])
      : null

  const valueY = (ref: GroupedBarReferenceLine, value: number) =>
    ref.yAxis === 'right' && yScaleRight ? yScaleRight(value) : yScale(value)

  const bucketCenter = (date: string) => (x0(date) ?? 0) + x0.bandwidth() / 2

  // —— Left Y-axis (fixed) ——
  if (showLeftAxis.value && leftAxisRef.value) {
    const leftSvg = d3.select(leftAxisRef.value)
    leftSvg.selectAll('*').remove()
    const leftG = leftSvg
      .append('g')
      .attr('transform', `translate(${props.margin.left - 6},${props.margin.top})`)
    leftG.append('g').call(d3.axisLeft(yScale).ticks(6)).attr('class', 'text-xs')
  }

  // —— Right Y-axis (fixed) ——
  if (hasRightAxis.value && rightAxisRef.value && yScaleRight) {
    const rightSvg = d3.select(rightAxisRef.value)
    rightSvg.selectAll('*').remove()
    const rightG = rightSvg.append('g').attr('transform', `translate(0,${props.margin.top})`)
    rightG.append('g').call(d3.axisRight(yScaleRight).ticks(5).tickFormat(eurTick)).attr('class', 'text-xs')
  }

  // —— Scrollable plot ——
  const plotSvg = d3.select(plotRef.value)
  plotSvg.selectAll('*').remove()
  const g = plotSvg.append('g').attr('transform', `translate(0,${props.margin.top})`)

  if (props.showBars) {
    for (const row of props.data) {
      const gx = g.append('g').attr('transform', `translate(${x0(row.date) ?? 0},0)`)

      for (const s of props.series) {
        const val = Number(row[s.key]) || 0
        const barH = innerHeight - yScale(val)
        if (barH < 1) continue

        gx.append('rect')
          .attr('x', x1(s.key) ?? 0)
          .attr('y', yScale(val))
          .attr('width', x1.bandwidth())
          .attr('height', barH)
          .attr('fill', s.color)
          .attr('rx', 2)
          .attr('class', 'transition-opacity hover:opacity-80')

        if (barH >= 14 && val > 0) {
          gx.append('text')
            .attr('x', (x1(s.key) ?? 0) + x1.bandwidth() / 2)
            .attr('y', yScale(val) - 4)
            .attr('text-anchor', 'middle')
            .attr('class', 'text-[9px] font-semibold fill-gray-900')
            .text(formatBar(val))
        }
      }
    }
  }

  const grid = g.append('g').attr('class', 'reference-grid').attr('pointer-events', 'none')
  for (const ref of props.referenceLines) {
    const stroke = ref.color ?? '#9ca3af'
    const dash = ref.dashArray
    const sw = ref.strokeWidth ?? 2
    const yFor = (value: number) => valueY(ref, value)

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
          : plotInnerWidth

      applyStrokeDash(
        grid
          .append('line')
          .attr('x1', xStart)
          .attr('x2', xEnd)
          .attr('y1', yFor(ref.value))
          .attr('y2', yFor(ref.value))
          .attr('stroke', stroke)
          .attr('stroke-width', sw)
          .attr('opacity', 0.95),
      )
      appendLabelBadge(grid, xEnd - 4, yFor(ref.value), ref.label, 'end')
    }

    if (ref.kind === 'series' && ref.points.length > 1) {
      const line = d3
        .line<{ date: string; value: number }>()
        .defined((p) => p.value > 0 && x0(p.date) != null)
        .x((p) => bucketCenter(p.date))
        .y((p) => yFor(p.value))

      applyStrokeDash(
        grid
          .append('path')
          .datum(ref.points)
          .attr('fill', 'none')
          .attr('stroke', stroke)
          .attr('stroke-width', sw)
          .attr('stroke-linecap', ref.strokeLinecap ?? 'butt')
          .attr('opacity', 0.95)
          .attr('d', line),
      )

      const last = [...ref.points].reverse().find((p) => p.value > 0)
      if (last) {
        appendLabelBadge(grid, bucketCenter(last.date), yFor(last.value), ref.label, 'middle')
      }
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

onMounted(() => nextTick(createChart))
watch(
  () => [
    props.data,
    props.series,
    props.referenceLines,
    props.width,
    props.height,
    props.dateGranularity,
    props.showBars,
    props.formatBarValue,
    hasRightAxis.value,
    showLeftAxis.value,
  ],
  () => nextTick(createChart),
  { deep: true, flush: 'post' },
)
</script>
