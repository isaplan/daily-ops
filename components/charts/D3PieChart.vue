<template>
  <div class="w-full h-full min-h-[300px]">
    <svg ref="svgRef" :width="width" :height="height" class="w-full"></svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import * as d3 from 'd3'

interface DataPoint {
  label: string
  value: number
}

const props = withDefaults(
  defineProps<{
    data: DataPoint[]
    width?: number
    height?: number
    colors?: string[]
    innerRadius?: number
  }>(),
  {
    width: 400,
    height: 300,
    colors: () => d3.schemeCategory10,
    innerRadius: 0,
  }
)

const svgRef = ref<SVGSVGElement | null>(null)

const isDonut = computed(() => props.innerRadius > 0)

const createChart = () => {
  if (!svgRef.value || !props.data.length) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const margin = { top: 10, right: 10, bottom: 10, left: 10 }
  const innerWidth = props.width - margin.left - margin.right
  const innerHeight = props.height - margin.top - margin.bottom
  const radius = Math.min(innerWidth, innerHeight) / 2

  const g = svg
    .append('g')
    .attr('transform', `translate(${props.width / 2},${props.height / 2})`)

  const pie = d3.pie<DataPoint>().value((d) => d.value)
  const arc = d3
    .arc<d3.PieArcDatum<DataPoint>>()
    .innerRadius(props.innerRadius)
    .outerRadius(radius)

  const arcs = g
    .selectAll('path')
    .data(pie(props.data))
    .enter()
    .append('path')
    .attr('d', arc)
    .attr('fill', (d, i) => props.colors[i % props.colors.length])
    .attr('class', 'transition-opacity hover:opacity-75')

  arcs
    .append('title')
    .text((d) => `${d.data.label}: ${d.data.value.toFixed(2)}`)

  const labelArc = d3
    .arc<d3.PieArcDatum<DataPoint>>()
    .innerRadius(radius * 0.6)
    .outerRadius(radius * 0.6)

  g.selectAll('.label')
    .data(pie(props.data))
    .enter()
    .append('text')
    .attr('transform', (d) => `translate(${labelArc.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('class', 'text-[10px] font-semibold fill-white pointer-events-none')
    .text((d) => {
      const total = props.data.reduce((sum, item) => sum + item.value, 0)
      const pct = ((d.data.value / total) * 100).toFixed(0)
      return `${pct}%`
    })
}

onMounted(() => {
  createChart()
})

watch(() => props.data, () => {
  createChart()
}, { deep: true })
</script>
