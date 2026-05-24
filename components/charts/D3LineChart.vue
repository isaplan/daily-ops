<template>
  <div class="w-full overflow-x-auto">
    <svg ref="svgRef" :width="width" :height="height" class="font-sans" />
  </div>
</template>

<script setup lang="ts">
import * as d3 from 'd3'

export type D3LineSeries = {
  id: string
  label: string
  color: string
  dashed?: boolean
  points: Array<{ date: string; value: number }>
}

const props = withDefaults(
  defineProps<{
    series: D3LineSeries[]
    width?: number
    height?: number
    margin?: { top: number; right: number; bottom: number; left: number }
  }>(),
  {
    width: 720,
    height: 280,
    margin: () => ({ top: 16, right: 24, bottom: 36, left: 56 }),
  },
)

const svgRef = ref<SVGSVGElement | null>(null)

function draw() {
  if (!svgRef.value || !props.series.length) return
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const innerW = props.width - props.margin.left - props.margin.right
  const innerH = props.height - props.margin.top - props.margin.bottom

  const allDates = [...new Set(props.series.flatMap((s) => s.points.map((p) => p.date)))].sort()
  const maxY =
    d3.max(props.series, (s) => d3.max(s.points, (p) => p.value) ?? 0) ?? 0

  const x = d3.scalePoint().domain(allDates).range([0, innerW]).padding(0.1)
  const y = d3.scaleLinear().domain([0, maxY * 1.05 || 1]).range([innerH, 0])

  const g = svg
    .append('g')
    .attr('transform', `translate(${props.margin.left},${props.margin.top})`)

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(allDates.filter((_, i) => i % Math.ceil(allDates.length / 8) === 0)),
    )
    .selectAll('text')
    .attr('transform', 'rotate(-35)')
    .style('text-anchor', 'end')
    .attr('font-size', 10)

  g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat((d) => `€${d}`))

  const line = d3
    .line<{ date: string; value: number }>()
    .x((d) => x(d.date) ?? 0)
    .y((d) => y(d.value))

  for (const s of props.series) {
    const sorted = [...s.points].sort((a, b) => a.date.localeCompare(b.date))
    g.append('path')
      .datum(sorted)
      .attr('fill', 'none')
      .attr('stroke', s.color)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', s.dashed ? '6 4' : null)
      .attr('d', line)
  }
}

watch(() => props.series, draw, { deep: true })
onMounted(draw)
</script>
