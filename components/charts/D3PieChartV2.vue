<template>
  <div class="w-full flex justify-center">
    <svg ref="svgRef" :width="width" :height="height" class="overflow-visible max-w-full h-auto" preserveAspectRatio="xMidYMid meet"></svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as d3 from 'd3'

interface DataPoint {
  label: string
  value: number
}

const props = withDefaults(
  defineProps<{
    data?: DataPoint[]
    width?: number
    height?: number
    colors?: string[]
    selectedPeriod?: string
  }>(),
  {
    width: 400,
    height: 300,
    colors: () => ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'],
    selectedPeriod: 'Selected Period',
  }
)

const svgRef = ref<SVGSVGElement | null>(null)

const createChart = () => {
  if (!svgRef.value) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const radius = Math.min(props.width, props.height) / 2 - 40

  const g = svg
    .append('g')
    .attr('transform', `translate(${props.width / 2},${props.height / 2})`)

  // Always add white background circle with black border
  g.append('circle')
    .attr('r', radius + 5)
    .attr('fill', 'white')
    .attr('stroke', '#111827')
    .attr('stroke-width', 2)

  // If no data, show message
  if (!props.data || props.data.length === 0 || !props.data.some(d => d.value > 0)) {
    g.append('text')
      .attr('x', 0)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('class', 'font-medium text-base fill-gray-500')
      .text('No Data Available')

    g.append('text')
      .attr('x', 0)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-sm fill-gray-400')
      .text(props.selectedPeriod)

    return
  }

  // Draw pie chart if data exists
  const pie = d3.pie<DataPoint>().value((d) => d.value)
  const arc = d3
    .arc<d3.PieArcDatum<DataPoint>>()
    .innerRadius(0)
    .outerRadius(radius)

  const arcs = g
    .selectAll('path')
    .data(pie(props.data))
    .enter()
    .append('path')
    .attr('d', arc)
    .attr('fill', (d, i) => props.colors[i % props.colors.length])
    .attr('stroke', 'white')
    .attr('stroke-width', 2)

  arcs
    .append('title')
    .text((d) => `${d.data.label}: ${d.data.value.toFixed(2)}`)

  const labelArc = d3
    .arc<d3.PieArcDatum<DataPoint>>()
    .innerRadius(radius * 0.65)
    .outerRadius(radius * 0.65)

  g.selectAll('.label')
    .data(pie(props.data))
    .enter()
    .append('text')
    .attr('transform', (d) => `translate(${labelArc.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('class', 'font-bold text-sm fill-gray-900 pointer-events-none')
    .text((d) => {
      const total = props.data!.reduce((sum, item) => sum + item.value, 0)
      const pct = ((d.data.value / total) * 100).toFixed(0)
      return `${pct}%`
    })
}

onMounted(() => {
  createChart()
})

watch(
  () => props.data,
  () => {
    createChart()
  },
  { deep: true }
)
</script>
