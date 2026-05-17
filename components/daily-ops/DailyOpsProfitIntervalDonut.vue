<template>
  <div class="flex min-w-0 flex-col items-center">
    <h3 class="mb-1 text-center text-sm font-semibold text-gray-900">{{ title }}</h3>
    <p
      class="mb-2 text-center text-xs font-medium tabular-nums"
      :style="{ color: statusColor }"
    >
      Day profit {{ formatEur(totalProfit) }}
    </p>

    <div class="relative" :style="chartBoxStyle">
      <svg
        ref="svgRef"
        :width="size"
        :height="size"
        class="overflow-visible"
        role="img"
        :aria-label="chartAriaLabel"
      />
    </div>

    <ul class="mt-3 w-full max-w-[220px] space-y-1.5 text-xs">
      <li
        v-for="row in legendRows"
        :key="row.key"
        class="flex items-center gap-2"
      >
        <span
          class="size-2.5 shrink-0 rounded-full border border-gray-900/15"
          :style="{ backgroundColor: row.color }"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 font-medium text-gray-700">{{ row.label }}</span>
        <span
          class="shrink-0 tabular-nums font-semibold"
          :style="{ color: profitTextColor(row.profit) }"
        >
          {{ row.profitDisplay }}
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import * as d3 from 'd3'
import {
  DAILY_OPS_PROFIT_INTERVAL_CHART_COLORS,
  DAILY_OPS_PROFIT_STATUS_RING,
  type ProfitIntervalSlice,
} from '~/utils/dailyOpsProfitIntervals'

const props = withDefaults(
  defineProps<{
    title: string
    totalProfit: number
    slices: ProfitIntervalSlice[]
    size?: number
  }>(),
  { size: 200 }
)

const { formatEur } = useDashboardEurFormat()

const svgRef = ref<SVGSVGElement | null>(null)

const statusColor = computed(() => {
  if (props.totalProfit > 0) return DAILY_OPS_PROFIT_STATUS_RING.positive
  if (props.totalProfit < 0) return DAILY_OPS_PROFIT_STATUS_RING.negative
  return DAILY_OPS_PROFIT_STATUS_RING.neutral
})

const chartBoxStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}))

const chartAriaLabel = computed(
  () => `${props.title}: profit ${formatEur(props.totalProfit)} by time of day`
)

function profitTextColor (profit: number): string {
  if (profit > 0) return DAILY_OPS_PROFIT_STATUS_RING.positive
  if (profit < 0) return DAILY_OPS_PROFIT_STATUS_RING.negative
  return '#6b7280'
}

const legendRows = computed(() =>
  props.slices.map((s) => ({
    key: s.key,
    label: s.label,
    color: DAILY_OPS_PROFIT_INTERVAL_CHART_COLORS[s.key],
    profit: s.profit,
    profitDisplay:
      s.profit !== 0 || s.hasData ? formatEur(s.profit) : '—',
  }))
)

const chartSlices = computed(() =>
  props.slices.filter((s) => Math.abs(s.profit) > 0.005 || s.hasData)
)

function drawChart (): void {
  const el = svgRef.value
  if (!el) return

  const svg = d3.select(el)
  svg.selectAll('*').remove()

  const w = props.size
  const h = props.size
  const cx = w / 2
  const cy = h / 2
  const outerR = Math.min(w, h) / 2 - 14
  const innerR = outerR * 0.58
  const ringR = outerR + 5

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`)

  g.append('circle')
    .attr('r', ringR)
    .attr('fill', 'none')
    .attr('stroke', statusColor.value)
    .attr('stroke-width', 5)
    .attr('opacity', 0.95)

  const data = chartSlices.value
  const totalAbs = data.reduce((sum, d) => sum + Math.abs(d.profit), 0)

  if (totalAbs <= 0) {
    g.append('circle')
      .attr('r', outerR)
      .attr('fill', '#f3f4f6')
      .attr('stroke', '#e5e7eb')
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('class', 'text-[11px] fill-gray-400')
      .text('No data')
    drawCenterLabel(g)
    return
  }

  const pie = d3
    .pie<ProfitIntervalSlice>()
    .value((d) => Math.abs(d.profit))
    .sort(null)

  const arc = d3
    .arc<d3.PieArcDatum<ProfitIntervalSlice>>()
    .innerRadius(innerR)
    .outerRadius(outerR)
    .padAngle(0.02)

  g.selectAll('path.slice')
    .data(pie(data))
    .enter()
    .append('path')
    .attr('class', 'slice')
    .attr('d', arc)
    .attr('fill', (d) => DAILY_OPS_PROFIT_INTERVAL_CHART_COLORS[d.data.key])
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .append('title')
    .text((d) => `${d.data.label}: ${formatEur(d.data.profit)}`)

  const labelArc = d3
    .arc<d3.PieArcDatum<ProfitIntervalSlice>>()
    .innerRadius((innerR + outerR) / 2)
    .outerRadius((innerR + outerR) / 2)

  g.selectAll('text.slice-label')
    .data(pie(data))
    .enter()
    .append('text')
    .attr('class', 'slice-label')
    .attr('transform', (d) => `translate(${labelArc.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('fill', '#1f2937')
    .attr('font-size', 9)
    .attr('font-weight', 600)
    .text((d) => {
      const pct = Math.round((Math.abs(d.data.profit) / totalAbs) * 100)
      return pct >= 8 ? `${pct}%` : ''
    })

  drawCenterLabel(g)
}

function drawCenterLabel (g: d3.Selection<SVGGElement, unknown, null, undefined>): void {
  const sign = props.totalProfit >= 0 ? '' : '−'
  const absVal = Math.abs(props.totalProfit)
  const main =
    absVal >= 1000
      ? `€${Math.round(absVal).toLocaleString('nl-NL')}`
      : formatEur(absVal).replace(/^€\s?/, '€')

  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '-0.15em')
    .attr('fill', statusColor.value)
    .attr('font-size', 13)
    .attr('font-weight', 700)
    .text(`${sign}${main}`)

  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '1.1em')
    .attr('fill', '#6b7280')
    .attr('font-size', 9)
    .attr('font-weight', 500)
    .text('profit')
}

onMounted(() => drawChart())

watch(
  () => [props.slices, props.totalProfit, props.size, statusColor.value],
  () => drawChart(),
  { deep: true }
)
</script>
