<template>
  <div class="w-full h-full min-h-[300px] flex items-center justify-center">
    <div v-if="!data || data.length === 0" class="text-center text-gray-400 text-sm">
      <p>No data available</p>
    </div>
    <svg v-else ref="svgRef" :width="width" :height="height" class="w-full h-auto"></svg>
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
    data?: DataPoint[]
    width?: number
    height?: number
    colors?: string[]
    innerRadius?: number
  }>(),
  {
    width: 400,
    height: 300,
    colors: () => ['#0a0a0a', '#242424', '#3d3d3d', '#575757', '#737373', '#b8b8b8', '#c9c9c9', '#d6d6d6'],
    innerRadius: 0,
  }
)

const svgRef = ref<SVGSVGElement | null>(null)

const createChart = () => {
  if (!svgRef.value || !props.data || props.data.length === 0) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const radius = Math.min(props.width, props.height) / 2 - 20

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
    .attr('stroke', 'none')
    .attr('class', 'transition-opacity hover:opacity-75 cursor-pointer')
    .on('mouseover', function () {
      d3.select(this).attr('opacity', 0.75)
    })
    .on('mouseout', function () {
      d3.select(this).attr('opacity', 1)
    })

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
    .attr('class', 'text-[11px] font-bold fill-white pointer-events-none')
    .text((d) => {
      const total = props.data!.reduce((sum, item) => sum + item.value, 0)
      const pct = ((d.data.value / total) * 100).toFixed(0)
      return `${pct}%`
    })

  // Add legend
  const legend = svg
    .append('g')
    .attr('transform', `translate(20, ${props.height - 80})`)

  const legendItems = pie(props.data)
  legendItems.forEach((d, i) => {
    const row = i
    const col = i % 2

    const legendItem = legend
      .append('g')
      .attr('transform', `translate(${col * 200}, ${row * 20})`)

    legendItem
      .append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', props.colors[i % props.colors.length])

    legendItem
      .append('text')
      .attr('x', 18)
      .attr('y', 10)
      .attr('class', 'text-xs fill-gray-700')
      .text(d.data.label.substring(0, 20))
  })
}

onMounted(() => {
  createChart()
})

watch(() => props.data, () => {
  createChart()
}, { deep: true })
</script>
