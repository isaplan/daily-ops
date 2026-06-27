<template>
  <div class="w-full h-full min-h-[280px] overflow-x-auto">
    <svg ref="svgRef" :width="svgWidth" :height="height" class="font-sans"></svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import * as d3 from 'd3'

export type StackedBarDataPoint = {
  date: string
  [key: string]: number | string
}

export type StackedBarReferenceLine = {
  id: string
  value: number
  label: string
  color?: string
  dashArray?: string
  strokeWidth?: number
}

const props = withDefaults(
  defineProps<{
    data: StackedBarDataPoint[]
    keys: string[]
    keyLabels?: Record<string, string>
    colors?: string[]
    referenceLines?: StackedBarReferenceLine[]
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
  },
)

const svgRef = ref<SVGSVGElement | null>(null)

const svgWidth = computed(() => Math.max(props.data.length * 48, props.width))

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

  const stackMax = d3.max(props.data, (d) =>
    props.keys.reduce((sum, key) => sum + (Number(d[key]) || 0), 0),
  ) ?? 0
  const refMax = d3.max(props.referenceLines, (r) => r.value) ?? 0
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

  const grid = g.append('g').attr('class', 'reference-grid')
  for (const ref of props.referenceLines) {
    if (ref.value <= 0) continue
    grid.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(ref.value))
      .attr('y2', yScale(ref.value))
      .attr('stroke', ref.color ?? '#9ca3af')
      .attr('stroke-width', ref.strokeWidth ?? 2)
      .attr('stroke-dasharray', ref.dashArray ?? '6,4')
      .attr('opacity', 0.95)
    grid.append('text')
      .attr('x', innerWidth - 4)
      .attr('y', yScale(ref.value) - 5)
      .attr('text-anchor', 'end')
      .attr('class', 'fill-gray-700 text-[10px] font-semibold')
      .attr('paint-order', 'stroke')
      .attr('stroke', 'white')
      .attr('stroke-width', 3)
      .text(ref.label)
  }

  const bars = g.append('g').attr('class', 'bars')
  bars
    .selectAll('g.layer')
    .data(stackedData)
    .enter()
    .append('g')
    .attr('class', 'layer')
    .attr('fill', (d) => colorScale(d.key) ?? '#6b7280')
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

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .attr('class', 'text-[10px]')
    .attr('transform', 'rotate(-35)')
    .style('text-anchor', 'end')
    .attr('dx', '-0.4em')
    .attr('dy', '0.2em')

  g.append('g').call(d3.axisLeft(yScale).ticks(6)).attr('class', 'text-xs')

  const legend = g.append('g').attr('transform', `translate(0,${-10})`)
  props.keys.forEach((key, i) => {
    const lx = i * 130
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

onMounted(createChart)
watch(
  () => [props.data, props.keys, props.colors, props.referenceLines, props.width, props.height],
  createChart,
  { deep: true },
)
</script>
