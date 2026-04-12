<template>
  <svg v-if="data && data.length > 0" ref="svgRef" :width="width" :height="height" class="overflow-visible"></svg>
  <svg v-else ref="svgRef" :width="width" :height="height" class="overflow-visible">
    <circle :cx="width / 2" :cy="height / 2" :r="(Math.min(width, height) / 2 - 35)" fill="white" stroke="#111827" stroke-width="2" />
    <text :x="width / 2" :y="height / 2 - 20" text-anchor="middle" class="font-medium text-gray-500">
      No Data Available
    </text>
    <text :x="width / 2" :y="height / 2 + 10" text-anchor="middle" class="text-sm text-gray-400">
      {{ selectedPeriod }}
    </text>
  </svg>
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
  if (!svgRef.value || !props.data || props.data.length === 0) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const radius = Math.min(props.width, props.height) / 2 - 40

  const g = svg
    .append('g')
    .attr('transform', `translate(${props.width / 2},${props.height / 2})`)

  // Add white background circle with black border
  g.append('circle')
    .attr('r', radius + 5)
    .attr('fill', 'white')
    .attr('stroke', '#111827')
    .attr('stroke-width', 2)

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
