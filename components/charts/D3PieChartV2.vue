<template>
  <div>
    <svg v-if="data && data.length > 0" ref="svgRef" :width="width" :height="height" class="rounded-lg overflow-hidden" style="border: 2px solid #111827;"></svg>
    <div v-else class="rounded-lg p-6 flex items-center justify-center" :style="{ height: `${height}px`, width: `${width}px`, border: '2px solid #111827' }">
      <div class="text-center">
        <p class="text-gray-500 text-base font-medium">No Data Available</p>
        <p class="text-gray-400 text-sm mt-2">{{ selectedPeriod }}</p>
      </div>
    </div>
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
  if (!svgRef.value || !props.data || props.data.length === 0) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const radius = Math.min(props.width, props.height) / 2 - 40

  const g = svg
    .append('g')
    .attr('transform', `translate(${props.width / 2},${props.height / 2})`)

  // Add white background circle
  g.append('circle')
    .attr('r', radius + 5)
    .attr('fill', 'white')
    .attr('stroke', '#e5e7eb')
    .attr('stroke-width', 1)

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
