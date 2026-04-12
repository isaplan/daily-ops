<template>
  <div class="w-full h-full min-h-[300px] overflow-x-auto">
    <svg ref="svgRef" :width="svgWidth" :height="height" class="font-sans"></svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import * as d3 from 'd3'

export interface StackedBarDataPoint {
  date: string
  [key: string]: number | string
}

interface StackedBarChartProps {
  data: StackedBarDataPoint[]
  keys: string[]
  width?: number
  height?: number
  colors?: string[]
  margin?: { top: number; right: number; bottom: number; left: number }
}

const props = withDefaults(defineProps<StackedBarChartProps>(), {
  width: 800,
  height: 400,
  colors: () => d3.schemeGreys(9),
  margin: () => ({ top: 20, right: 30, bottom: 30, left: 60 }),
})

const svgRef = ref<SVGSVGElement | null>(null)

const svgWidth = computed(() => {
  const minWidth = Math.max(props.data.length * 40, props.width)
  return minWidth
})

const createChart = () => {
  if (!svgRef.value || !props.data.length) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const innerWidth = svgWidth.value - props.margin.left - props.margin.right
  const innerHeight = props.height - props.margin.top - props.margin.bottom

  const xScale = d3
    .scaleBand()
    .domain(props.data.map((d) => d.date as string))
    .range([0, innerWidth])
    .padding(0.1)

  const yMax = d3.max(props.data, (d) =>
    props.keys.reduce((sum, key) => sum + (Number(d[key]) || 0), 0)
  ) || 0

  const yScale = d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0])

  const colorScale = d3
    .scaleOrdinal()
    .domain(props.keys)
    .range(props.colors)

  const stack = d3
    .stack()
    .keys(props.keys)
    .value((d, key) => Number(d[key]) || 0)

  const stackedData = stack(props.data as any)

  const g = svg
    .append('g')
    .attr('transform', `translate(${props.margin.left},${props.margin.top})`)

  g.selectAll('g')
    .data(stackedData)
    .enter()
    .append('g')
    .attr('fill', (d) => colorScale(d.key) as string)
    .selectAll('rect')
    .data((d) => d)
    .enter()
    .append('rect')
    .attr('x', (d) => xScale(d.data.date as string) || 0)
    .attr('y', (d) => yScale(d[1]))
    .attr('height', (d) => yScale(d[0]) - yScale(d[1]))
    .attr('width', xScale.bandwidth())
    .attr('class', 'transition-opacity hover:opacity-75')

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .attr('class', 'text-xs')

  g.append('g')
    .call(d3.axisLeft(yScale))
    .attr('class', 'text-xs')
}

onMounted(() => {
  createChart()
})

watch(() => props.data, () => {
  createChart()
}, { deep: true })
</script>
