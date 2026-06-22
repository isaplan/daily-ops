<template>
  <div class="overflow-hidden rounded-lg border-2 border-gray-900 bg-white">
    <div class="border-b border-gray-100 px-4 py-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ periodLabel }}</p>
      <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
        <span
          v-for="item in legendItems"
          :key="item.key"
          class="inline-flex items-center gap-1.5"
        >
          <span
            class="inline-block h-2.5 w-2.5 rounded-sm"
            :style="{ backgroundColor: item.color }"
          />
          {{ item.label }}
        </span>
      </div>
    </div>
    <div
      ref="containerRef"
      class="scrollbar-hide overflow-x-auto overscroll-x-contain touch-pan-x p-4"
    >
      <svg
        ref="svgRef"
        :width="svgWidth"
        :height="svgHeight"
        class="font-sans"
        role="img"
        :aria-label="ariaLabel"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import * as d3 from 'd3'
import type {
  AccountingPnlMonthGridDto,
  AccountingPnlYearGridDto,
} from '~/types/accounting-pnl-benchmark'
import type { AccountingPnlRow, AccountingPnlVenueId } from '~/utils/accountingPnlData'
import { ACCOUNTING_PNL_VENUES } from '~/utils/accountingPnlData'
import { formatAccountingPnlCompact } from '~/utils/accountingPnlFormat'

type PnlChartLayout = 'year' | 'month'
type PnlValueMode = 'amount' | 'percent'

type StackSegment = {
  key: string
  label: string
  color: string
}

type BarDatum = {
  groupKey: string
  groupLabel: string
  barKey: string
  barLabel: string
  segments: Record<string, number>
}

const VENUE_COLORS: Record<AccountingPnlVenueId, string> = {
  vkb: '#111827',
  bea: '#4B5563',
  lat: '#9CA3AF',
}

const PNL_SEGMENT_DEFS: StackSegment[] = [
  { key: 'cogs', label: 'COGS', color: '#374151' },
  { key: 'labor', label: 'Labor', color: '#6B7280' },
  { key: 'fixed', label: 'Fixed', color: '#D1D5DB' },
  { key: 'result', label: 'Result', color: '#059669' },
]

const NEGATIVE_FILL = '#DC2626'

const props = withDefaults(
  defineProps<{
    layout: PnlChartLayout
    periodLabel: string
    yearGrid?: AccountingPnlYearGridDto | null
    monthGrid?: AccountingPnlMonthGridDto | null
    activeVenueIds?: AccountingPnlVenueId[]
    valueMode?: PnlValueMode
    width?: number
    height?: number
  }>(),
  {
    yearGrid: null,
    monthGrid: null,
    activeVenueIds: () => ['vkb', 'bea', 'lat'],
    valueMode: 'amount',
    width: 1536,
    height: 360,
  },
)

const containerRef = ref<HTMLElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
const containerWidth = ref(720)

const svgHeight = computed(() => props.height)
const margin = { top: 12, right: 16, bottom: 52, left: 56 }

const activeVenueSet = computed(() => new Set(props.activeVenueIds))

const venueSegments = computed((): StackSegment[] =>
  ACCOUNTING_PNL_VENUES
    .filter((v) => activeVenueSet.value.has(v.id))
    .map((v) => ({ key: v.id, label: v.shortLabel, color: VENUE_COLORS[v.id] })),
)

const stackSegments = computed((): StackSegment[] =>
  props.layout === 'year' ? venueSegments.value : PNL_SEGMENT_DEFS,
)

const legendItems = computed(() => stackSegments.value)

const ariaLabel = computed(() =>
  props.layout === 'year'
    ? 'Stacked revenue by year and venue'
    : 'Stacked P&L by month and venue',
)

function pnlSegment (row: AccountingPnlRow, key: string): number {
  switch (key) {
    case 'cogs': return row.cogs
    case 'labor': return row.labor
    case 'fixed': return row.fixed
    case 'result': return row.result
    default: return 0
  }
}

function scaledValue (value: number, revenue: number): number {
  if (props.valueMode !== 'percent') return value
  const base = Math.abs(revenue)
  if (base <= 0) return value < 0 ? -100 : 0
  return (value / base) * 100
}

const barData = computed((): BarDatum[] => {
  if (props.layout === 'year' && props.yearGrid) {
    return props.yearGrid.columns.map((column) => {
      const activeVenues = column.venues.filter((v) => activeVenueSet.value.has(v.key))
      const totalRevenue = activeVenues.reduce((sum, v) => sum + v.row.revenue, 0)
      const segments: Record<string, number> = {}
      for (const venue of activeVenues) {
        segments[venue.key] = scaledValue(venue.row.revenue, totalRevenue)
      }
      return {
        groupKey: String(column.year),
        groupLabel: column.year === 2026 ? '2026' : String(column.year),
        barKey: 'year',
        barLabel: String(column.year),
        segments,
      }
    })
  }

  if (props.layout === 'month' && props.monthGrid) {
    return props.monthGrid.columns.flatMap((column) => {
      const activeVenues = column.venues.filter((v) => activeVenueSet.value.has(v.key))
      return activeVenues.map((venue) => {
        const segments: Record<string, number> = {}
        for (const seg of PNL_SEGMENT_DEFS) {
          segments[seg.key] = scaledValue(pnlSegment(venue.row, seg.key), venue.row.revenue)
        }
        return {
          groupKey: String(column.month),
          groupLabel: column.label.slice(0, 3),
          barKey: venue.key,
          barLabel: venue.shortLabel,
          segments,
        }
      })
    })
  }

  return []
})

const svgWidth = computed(() => {
  const groupCount = new Set(barData.value.map((d) => d.groupKey)).size
  const barsPerGroup = props.layout === 'month'
    ? Math.max(props.activeVenueIds.filter((id) => activeVenueSet.value.has(id)).length, 1)
    : 1
  const groupWidth = barsPerGroup * 30 + 32
  return Math.max(containerWidth.value, groupCount * groupWidth + margin.left + margin.right)
})

function formatAxisValue (value: number): string {
  const sign = value < 0 ? '−' : ''
  const abs = Math.abs(value)
  if (props.valueMode === 'percent') return `${sign}${Math.round(abs)}%`
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}€${Math.round(abs / 1_000)}k`
  return `${sign}€${Math.round(abs)}`
}

function formatTooltipValue (value: number): string {
  if (props.valueMode === 'percent') {
    const sign = value < 0 ? '−' : ''
    return `${sign}${Math.round(Math.abs(value) * 10) / 10}%`
  }
  return formatAccountingPnlCompact(value)
}

function barX (meta: BarDatum, x0: d3.ScaleBand<string>, x1: d3.ScaleBand<string>): number {
  const groupX = x0(meta.groupKey) ?? 0
  if (props.layout === 'month') return groupX + (x1(meta.barKey) ?? 0)
  return groupX
}

function barWidth (x0: d3.ScaleBand<string>, x1: d3.ScaleBand<string>): number {
  return props.layout === 'month' ? x1.bandwidth() : x0.bandwidth()
}

function createChart () {
  if (!svgRef.value) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const data = barData.value
  const keys = stackSegments.value.map((s) => s.key)
  if (!data.length || !keys.length) return

  const innerWidth = svgWidth.value - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const groups = [...new Set(data.map((d) => d.groupKey))]
  const barKeys = props.layout === 'month'
    ? props.activeVenueIds.filter((id) => activeVenueSet.value.has(id))
    : ['year']

  const x0 = d3.scaleBand()
    .domain(groups)
    .range([0, innerWidth])
    .paddingInner(props.layout === 'month' ? 0.45 : 0.35)
    .paddingOuter(0.08)

  const x1 = d3.scaleBand()
    .domain(barKeys)
    .range([0, x0.bandwidth()])
    .padding(0.12)

  type StackRow = Record<string, number | string> & { _meta: BarDatum }
  const stackInput: StackRow[] = data.map((d) => {
    const positive: Record<string, number> = {}
    for (const key of keys) {
      const raw = Number(d.segments[key]) || 0
      positive[key] = Math.max(0, raw)
    }
    return {
      ...positive,
      groupKey: d.groupKey,
      barKey: d.barKey,
      _meta: d,
    }
  })

  const stack = d3.stack<StackRow>()
    .keys(keys)
    .value((d, key) => Number(d[key]) || 0)

  const stacked = stack(stackInput)

  let yMax = d3.max(stacked, (layer) => d3.max(layer, (d) => d[1])) ?? 0
  let yMin = 0
  for (const d of data) {
    for (const key of keys) {
      const raw = Number(d.segments[key]) || 0
      if (raw < 0) yMin = Math.min(yMin, raw)
    }
  }

  const yScale = d3.scaleLinear()
    .domain([yMin * 1.08, yMax * 1.05])
    .nice()
    .range([innerHeight, 0])

  const zeroY = yScale(0)
  const colorFor = (key: string) =>
    stackSegments.value.find((s) => s.key === key)?.color ?? '#111827'

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  if (yMin < 0) {
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', zeroY)
      .attr('y2', zeroY)
      .attr('stroke', '#111827')
      .attr('stroke-width', 1)
  }

  for (const d of data) {
    for (const key of keys) {
      const raw = Number(d.segments[key]) || 0
      if (raw >= 0) continue
      const meta = d
      const segLabel = stackSegments.value.find((s) => s.key === key)?.label ?? key
      g.append('rect')
        .attr('x', barX(meta, x0, x1))
        .attr('y', yScale(0))
        .attr('height', Math.abs(yScale(raw) - zeroY))
        .attr('width', barWidth(x0, x1))
        .attr('fill', NEGATIVE_FILL)
        .attr('class', 'transition-opacity hover:opacity-80')
        .append('title')
        .text(props.layout === 'month'
          ? `${meta.groupLabel} · ${meta.barLabel} · ${segLabel}: ${formatTooltipValue(raw)}`
          : `${meta.groupLabel} · ${segLabel}: ${formatTooltipValue(raw)}`)
    }
  }

  for (const layer of stacked) {
    const layerG = g.append('g').attr('class', 'layer')

    layerG.selectAll('rect')
      .data(layer)
      .enter()
      .append('rect')
      .attr('fill', (d) => {
        const raw = Number(d.data._meta.segments[layer.key]) || 0
        if (raw <= 0) return 'transparent'
        if (layer.key === 'result') return '#059669'
        return colorFor(layer.key)
      })
      .attr('x', (d) => barX(d.data._meta, x0, x1))
      .attr('y', (d) => {
        const raw = Number(d.data._meta.segments[layer.key]) || 0
        if (raw <= 0) return zeroY
        return yScale(d[1])
      })
      .attr('height', (d) => {
        const raw = Number(d.data._meta.segments[layer.key]) || 0
        if (raw <= 0) return 0
        return Math.abs(yScale(d[0]) - yScale(d[1]))
      })
      .attr('width', barWidth(x0, x1))
      .attr('class', 'transition-opacity hover:opacity-80')
      .append('title')
      .text((d) => {
        const meta = d.data._meta
        const raw = Number(meta.segments[layer.key]) || 0
        if (raw <= 0) return ''
        const segLabel = stackSegments.value.find((s) => s.key === layer.key)?.label ?? layer.key
        if (props.layout === 'month') {
          return `${meta.groupLabel} · ${meta.barLabel} · ${segLabel}: ${formatTooltipValue(raw)}`
        }
        return `${meta.groupLabel} · ${segLabel}: ${formatTooltipValue(raw)}`
      })
  }

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x0).tickFormat((_, i) => {
      const groupKey = groups[i]
      return data.find((d) => d.groupKey === groupKey)?.groupLabel ?? String(groupKey)
    }))
    .call((axis) => axis.selectAll('text')
      .attr('class', 'fill-gray-600 text-[11px] font-medium'))

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => formatAxisValue(Number(d))))
    .call((axis) => axis.selectAll('text').attr('class', 'fill-gray-500 text-[10px]'))

  if (props.layout === 'month') {
    g.selectAll('text.venue-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'venue-label fill-gray-500 text-[9px] font-semibold')
      .attr('text-anchor', 'middle')
      .attr('x', (d) => {
        const groupX = x0(d.groupKey) ?? 0
        return groupX + (x1(d.barKey) ?? 0) + x1.bandwidth() / 2
      })
      .attr('y', innerHeight + 28)
      .text((d) => d.barLabel)
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) containerWidth.value = entry.contentRect.width
    })
    resizeObserver.observe(containerRef.value)
  }
  createChart()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch([barData, stackSegments, () => props.valueMode, svgWidth], () => {
  nextTick(() => createChart())
}, { deep: true })
</script>
