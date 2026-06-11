<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-3 text-[10px] text-gray-600">
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-2 w-2 rounded-sm bg-emerald-600" /> Over contract
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-2 w-2 rounded-sm bg-amber-600" /> Under contract
      </span>
      <span v-if="contractWeekly != null" class="text-gray-500">
        Baseline = {{ contractWeekly }}h/wk contract
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-0.5 w-3 rounded bg-gray-900" /> Cumulative Δ
      </span>
    </div>
    <div
      class="scrollbar-hide w-full overflow-x-auto overscroll-x-contain touch-pan-x"
      :style="scrollMaxWidth != null ? { maxWidth: `${scrollMaxWidth}px` } : undefined"
    >
      <svg
        ref="svgRef"
        :width="svgWidth"
        :height="chartHeight"
        class="font-sans"
        role="img"
        :aria-label="ariaLabel"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import * as d3 from 'd3'
import type { StaffWeeklyHoursWeek } from '~/types/daily-ops-staff'

type ChartWeek = {
  week_key: string
  label: string
  delta: number
  worked: number
  contract: number
  cumulative: number
  tooltip: string
}

const props = withDefaults(
  defineProps<{
    weeks: StaffWeeklyHoursWeek[]
    contractWeekly: number | null
    containerWidth?: number
    containerHeight?: number
    expanded?: boolean
  }>(),
  {
    containerWidth: 320,
    containerHeight: 420,
    expanded: false,
  },
)

const svgRef = ref<SVGSVGElement | null>(null)

const barStep = 30
const margin = { top: 10, right: 12, bottom: 26, left: 44 }

const chartWeeks = computed((): ChartWeek[] => {
  let cumulative = 0
  return props.weeks
    .map((w) => {
      const contract = w.contract_hours ?? props.contractWeekly ?? 0
      const delta =
        w.delta_vs_contract ??
        (w.contract_hours != null || props.contractWeekly != null ? w.worked_hours - contract : null)
      if (delta == null || !Number.isFinite(delta)) return null
      cumulative += delta
      return {
        week_key: w.week_key,
        label: shortLabel(w.week_key),
        delta,
        worked: w.worked_hours,
        contract,
        cumulative,
        tooltip: `${w.week_label}: ${w.worked_hours.toFixed(1)}h worked · ${contract.toFixed(1)}h contract · ${signed(delta)}h this week · ${signed(cumulative)}h cumulative`,
      }
    })
    .filter((w): w is ChartWeek => w != null)
})

const chartHeight = computed(() =>
  props.expanded
    ? Math.max(280, Math.round(props.containerHeight))
    : 148,
)

const svgWidth = computed(() =>
  Math.max(
    props.containerWidth,
    chartWeeks.value.length * barStep + margin.left + margin.right,
  ),
)

const scrollMaxWidth = computed(() => (props.expanded ? null : props.containerWidth))

const ariaLabel = computed(() => {
  const n = chartWeeks.value.length
  const base = props.contractWeekly != null ? `${props.contractWeekly} hours per week contract` : 'contract hours'
  return `Weekly worked hours versus ${base}, ${n} weeks year to date`
})

function shortLabel(weekKey: string) {
  return weekKey.replace(/^\d+-W0?/, 'W')
}

function signed(n: number) {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}`
}

function drawChart() {
  const svgEl = svgRef.value
  if (!svgEl || chartWeeks.value.length === 0) return

  const data = chartWeeks.value
  const innerW = svgWidth.value - margin.left - margin.right
  const innerH = chartHeight.value - margin.top - margin.bottom

  const maxAbsDelta = Math.max(1, ...data.map((d) => Math.abs(d.delta)))
  const cumMin = d3.min(data, (d) => d.cumulative) ?? 0
  const cumMax = d3.max(data, (d) => d.cumulative) ?? 0
  const yMax = Math.max(maxAbsDelta, Math.abs(cumMin), Math.abs(cumMax)) * 1.12

  const x = d3.scaleBand<string>()
    .domain(data.map((d) => d.week_key))
    .range([0, innerW])
    .padding(0.25)

  const y = d3.scaleLinear().domain([-yMax, yMax]).range([innerH, 0]).nice()

  const bandCenter = (weekKey: string) => (x(weekKey) ?? 0) + x.bandwidth() / 2

  const cumulativeLine = d3
    .line<ChartWeek>()
    .x((d) => bandCenter(d.week_key))
    .y((d) => y(d.cumulative))

  const svg = d3.select(svgEl)
  svg.selectAll('*').remove()
  svg.attr('width', svgWidth.value).attr('height', chartHeight.value)

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const zeroY = y(0)

  g.append('line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', zeroY)
    .attr('y2', zeroY)
    .attr('stroke', '#111827')
    .attr('stroke-width', 1.5)

  g.selectAll('rect.delta-bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'delta-bar')
    .attr('x', (d) => x(d.week_key) ?? 0)
    .attr('width', x.bandwidth())
    .attr('y', (d) => (d.delta >= 0 ? y(d.delta) : zeroY))
    .attr('height', (d) => Math.max(1, Math.abs(y(d.delta) - zeroY)))
    .attr('rx', 2)
    .attr('fill', (d) => (d.delta >= 0 ? '#059669' : '#d97706'))
    .each(function (d) {
      d3.select(this).append('title').text(d.tooltip)
    })

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#111827')
    .attr('stroke-width', 2)
    .attr('stroke-linejoin', 'round')
    .attr('stroke-linecap', 'round')
    .attr('d', cumulativeLine)

  g.selectAll('circle.cumulative-point')
    .data(data)
    .enter()
    .append('circle')
    .attr('class', 'cumulative-point')
    .attr('cx', (d) => bandCenter(d.week_key))
    .attr('cy', (d) => y(d.cumulative))
    .attr('r', 2.5)
    .attr('fill', '#111827')
    .each(function (d) {
      d3.select(this).append('title').text(`Cumulative vs contract: ${signed(d.cumulative)}h`)
    })

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(
      d3.axisBottom(x)
        .tickFormat((key) => shortLabel(String(key)))
        .tickSize(0)
    )
    .call((sel) => sel.select('.domain').remove())
    .selectAll('text')
    .attr('class', 'fill-gray-500 text-[9px]')

  g.append('g')
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickSize(-innerW)
        .tickFormat((v) => `${Number(v) > 0 ? '+' : ''}${v}`)
    )
    .call((sel) => sel.select('.domain').remove())
    .call((sel) => sel.selectAll('.tick line').attr('stroke', '#e5e7eb').attr('stroke-dasharray', '2,2'))
    .selectAll('text')
    .attr('class', 'fill-gray-500 text-[9px]')
}

watch([chartWeeks, svgWidth, chartHeight], () => {
  nextTick(() => drawChart())
}, { deep: true })

onMounted(() => {
  drawChart()
})
</script>
