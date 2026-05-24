<template>
  <div class="overflow-x-auto">
    <svg ref="svgRef" :width="width" :height="height" class="font-sans" />
  </div>
</template>

<script setup lang="ts">
import * as d3 from 'd3'

const props = withDefaults(
  defineProps<{
    rows: Array<{ label: string; values: number[] }>
    colLabels: string[]
    width?: number
    height?: number
  }>(),
  { width: 520, height: 420 },
)

const svgRef = ref<SVGSVGElement | null>(null)

function draw() {
  if (!svgRef.value || !props.rows.length) return
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const margin = { top: 24, right: 12, bottom: 12, left: 36 }
  const cellW = 48
  const cellH = 14
  const max = d3.max(props.rows, (r) => d3.max(r.values) ?? 0) ?? 1
  const color = d3.scaleSequential(d3.interpolateGreens).domain([0, max])

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  props.colLabels.forEach((lbl, ci) => {
    g.append('text')
      .attr('x', ci * cellW + cellW / 2)
      .attr('y', -6)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .text(lbl)
  })

  props.rows.forEach((row, ri) => {
    g.append('text')
      .attr('x', -4)
      .attr('y', ri * cellH + cellH / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', 10)
      .text(row.label)

    row.values.forEach((v, ci) => {
      const rect = g
        .append('rect')
        .attr('x', ci * cellW)
        .attr('y', ri * cellH)
        .attr('width', cellW - 2)
        .attr('height', cellH - 2)
        .attr('fill', v > 0 ? color(v) : '#f9fafb')
      rect.append('title').text(`${row.label} ${props.colLabels[ci]}: €${v.toFixed(0)}`)
    })
  })

  const totalH = props.rows.length * cellH + margin.top + margin.bottom
  const totalW = props.colLabels.length * cellW + margin.left + margin.right
  svg.attr('width', Math.max(props.width, totalW)).attr('height', Math.max(props.height, totalH))
}

watch(() => [props.rows, props.colLabels], draw, { deep: true })
onMounted(draw)
</script>
