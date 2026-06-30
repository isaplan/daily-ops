<template>
  <div ref="scrollRef" class="w-full h-full min-h-[280px] overflow-x-auto">
    <svg ref="svgRef" :width="svgWidth" :height="height" class="font-sans"></svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import * as d3 from 'd3'
import type { StaffChartGranularity } from '~/utils/dailyOpsStaffNav/modes'
import { formatStaffChartBucketLabel } from '~/utils/dailyOpsStaffChartLabels'

export type StackedBarDataPoint = {
  date: string
  [key: string]: number | string
}

export type StackedBarReferenceLine = {
  id: string
  kind?: 'flat' | 'series'
  value?: number
  points?: Array<{ date: string; value: number }>
  label: string
  color?: string
  dashArray?: string
  strokeWidth?: number
  strokeLinecap?: 'butt' | 'round' | 'square'
}

const props = withDefaults(
  defineProps<{
    data: StackedBarDataPoint[]
    keys: string[]
    keyLabels?: Record<string, string>
    colors?: string[]
    referenceLines?: StackedBarReferenceLine[]
    dateGranularity?: StaffChartGranularity
    showPercentLabels?: boolean
    showValueLabels?: boolean
    formatSegmentValue?: (value: number) => string
    hideLegend?: boolean
    width?: number
    height?: number
    margin?: { top: number; right: number; bottom: number; left: number }
  }>(),
  {
    width: 800,
    height: 400,
    colors: () => ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626'],
    margin: () => ({ top: 28, right: 24, bottom: 52, left: 56 }),
    referenceLines: () => [],
    keyLabels: () => ({}),
    dateGranularity: 'week',
    showPercentLabels: false,
    showValueLabels: false,
    hideLegend: false,
  },
)

const svgRef = ref<SVGSVGElement | null>(null)
const scrollRef = ref<HTMLDivElement | null>(null)

const svgWidth = computed(() => Math.max(props.data.length * 48, props.width))

function stackTotal(row: StackedBarDataPoint): number {
  return props.keys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0)
}

function createChart() {
  if (!svgRef.value || !props.data.length || !props.keys.length) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const innerWidth = svgWidth.value - props.margin.left - props.margin.right
  const innerHeight = props.height - props.margin.top - props.margin.bottom

  const xScale = d3
    .scaleBand()
    .domain(props.data.map((d) => d.date))
    .range([0, innerWidth])
    .padding(0.18)

  const stackMax = d3.max(props.data, (d) => stackTotal(d)) ?? 0
  const refFlatMax = d3.max(props.referenceLines, (r) => r.value ?? 0) ?? 0
  const refSeriesMax = d3.max(
    props.referenceLines.flatMap((r) => (r.points ?? []).map((p) => p.value)),
  ) ?? 0
  const refMax = Math.max(refFlatMax, refSeriesMax)
  const yMax = Math.max(stackMax, refMax)

  const yScale = d3.scaleLinear().domain([0, yMax > 0 ? yMax : 1]).nice().range([innerHeight, 0])

  const colorScale = d3.scaleOrdinal<string>().domain(props.keys).range(props.colors)

  const stack = d3
    .stack<StackedBarDataPoint>()
    .keys(props.keys)
    .value((d, key) => Number(d[key]) || 0)

  const stackedData = stack(props.data)

  const g = svg
    .append('g')
    .attr('transform', `translate(${props.margin.left},${props.margin.top})`)

  const bars = g.append('g').attr('class', 'bars')
  const layers = bars
    .selectAll('g.layer')
    .data(stackedData)
    .enter()
    .append('g')
    .attr('class', 'layer')
    .attr('fill', (d) => colorScale(d.key) ?? '#6b7280')

  layers
    .selectAll('rect')
    .data((d) => d)
    .enter()
    .append('rect')
    .attr('x', (d) => xScale(String(d.data.date)) ?? 0)
    .attr('y', (d) => yScale(d[1]))
    .attr('height', (d) => Math.max(0, yScale(d[0]) - yScale(d[1])))
    .attr('width', xScale.bandwidth())
    .attr('rx', 2)
    .attr('class', 'transition-opacity hover:opacity-80')

  if (props.showPercentLabels) {
    layers.each(function (layer) {
      const layerG = d3.select(this)
      layerG
        .selectAll('g.segment-pct')
        .data(layer)
        .enter()
        .append('g')
        .attr('class', 'segment-pct')
        .attr('pointer-events', 'none')
        .each(function (d) {
          const total = stackTotal(d.data)
          const value = d[1] - d[0]
          const height = Math.max(0, yScale(d[0]) - yScale(d[1]))
          const pct = total > 0 ? Math.round((value / total) * 100) : 0
          const x = (xScale(String(d.data.date)) ?? 0) + xScale.bandwidth() / 2
          const y = yScale(d[1]) + height / 2
          const g = d3.select(this)
          if (height < 14 || pct < 6 || value <= 0) {
            g.remove()
            return
          }
          const label = `${pct}%`
          g.append('text')
            .attr('class', 'text-[9px] font-semibold fill-white')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('x', x)
            .attr('y', y)
            .attr('opacity', 0)
            .text(label)
          const textNode = g.select('text').node() as SVGTextElement | null
          if (!textNode) return
          const bbox = textNode.getBBox()
          g.insert('rect', 'text')
            .attr('x', bbox.x - 3)
            .attr('y', bbox.y - 1)
            .attr('width', bbox.width + 6)
            .attr('height', bbox.height + 2)
            .attr('rx', 2)
            .attr('fill', 'rgba(0,0,0,0.45)')
          g.select('text').attr('opacity', 1)
        })
    })
  }

  if (props.showValueLabels && props.formatSegmentValue) {
    const fmt = props.formatSegmentValue
    layers.each(function (layer) {
      const layerG = d3.select(this)
      layerG
        .selectAll('g.segment-val')
        .data(layer)
        .enter()
        .append('g')
        .attr('class', 'segment-val')
        .attr('pointer-events', 'none')
        .each(function (d) {
          const value = d[1] - d[0]
          const height = Math.max(0, yScale(d[0]) - yScale(d[1]))
          const x = (xScale(String(d.data.date)) ?? 0) + xScale.bandwidth() / 2
          const y = yScale(d[1]) + height / 2
          const g = d3.select(this)
          if (height < 16 || value <= 0) {
            g.remove()
            return
          }
          const label = fmt(value)
          g.append('text')
            .attr('class', 'text-[9px] font-semibold fill-white')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('x', x)
            .attr('y', y)
            .attr('opacity', 0)
            .text(label)
          const textNode = g.select('text').node() as SVGTextElement | null
          if (!textNode) return
          const bbox = textNode.getBBox()
          g.insert('rect', 'text')
            .attr('x', bbox.x - 3)
            .attr('y', bbox.y - 1)
            .attr('width', bbox.width + 6)
            .attr('height', bbox.height + 2)
            .attr('rx', 2)
            .attr('fill', 'rgba(0,0,0,0.45)')
          g.select('text').attr('opacity', 1)
        })
    })
  }

  const grid = g.append('g').attr('class', 'reference-grid').attr('pointer-events', 'none')
  const applyStrokeDash = (
    sel: d3.Selection<d3.BaseType, unknown, d3.BaseType, unknown>,
    dash?: string,
  ) => {
    if (dash) sel.attr('stroke-dasharray', dash)
    else sel.attr('stroke-dasharray', null)
  }

  for (const ref of props.referenceLines) {
    const stroke = ref.color ?? '#9ca3af'
    const sw = ref.strokeWidth ?? 2
    const dash = ref.dashArray

    if (ref.kind === 'series' && ref.points && ref.points.length > 1) {
      const line = d3
        .line<{ date: string; value: number }>()
        .defined((p) => p.value > 0 && xScale(p.date) != null)
        .x((p) => (xScale(p.date) ?? 0) + xScale.bandwidth() / 2)
        .y((p) => yScale(p.value))
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
        dash,
      )
      const last = [...ref.points].reverse().find((p) => p.value > 0)
      if (last && xScale(last.date) != null) {
        grid
          .append('text')
          .attr('x', innerWidth - 4)
          .attr('y', yScale(last.value) - 5)
          .attr('text-anchor', 'end')
          .attr('class', 'fill-gray-700 text-[10px] font-semibold')
          .attr('paint-order', 'stroke')
          .attr('stroke', 'white')
          .attr('stroke-width', 3)
          .text(ref.label)
      }
      continue
    }

    const flatValue = ref.value ?? 0
    if (flatValue <= 0) continue
    applyStrokeDash(
      grid
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(flatValue))
        .attr('y2', yScale(flatValue))
        .attr('stroke', stroke)
        .attr('stroke-width', sw)
        .attr('opacity', 0.95),
      dash,
    )
    grid.append('text')
      .attr('x', innerWidth - 4)
      .attr('y', yScale(flatValue) - 5)
      .attr('text-anchor', 'end')
      .attr('class', 'fill-gray-700 text-[10px] font-semibold')
      .attr('paint-order', 'stroke')
      .attr('stroke', 'white')
      .attr('stroke-width', 3)
      .text(ref.label)
  }

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(xScale)
        .tickFormat((d) => formatStaffChartBucketLabel(String(d), props.dateGranularity)),
    )
    .selectAll('text')
    .attr('class', 'text-[10px]')
    .attr('transform', 'rotate(-35)')
    .style('text-anchor', 'end')
    .attr('dx', '-0.4em')
    .attr('dy', '0.2em')

  g.append('g').call(d3.axisLeft(yScale).ticks(6)).attr('class', 'text-xs')

  if (!props.hideLegend) {
    const legend = g.append('g').attr('transform', `translate(0,${-10})`)
    props.keys.forEach((key, i) => {
      const lx = i * 72
      legend
        .append('rect')
        .attr('x', lx)
        .attr('y', -10)
        .attr('width', 10)
        .attr('height', 10)
        .attr('fill', colorScale(key) ?? '#6b7280')
        .attr('rx', 1)
      legend
        .append('text')
        .attr('x', lx + 14)
        .attr('y', -1)
        .attr('class', 'text-xs fill-gray-700')
        .text(props.keyLabels[key] ?? key)
    })
  }

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
  () => [
    props.data,
    props.keys,
    props.colors,
    props.referenceLines,
    props.width,
    props.height,
    props.dateGranularity,
    props.showPercentLabels,
    props.showValueLabels,
    props.formatSegmentValue,
    props.hideLegend,
  ],
  createChart,
  { deep: true },
)
</script>
