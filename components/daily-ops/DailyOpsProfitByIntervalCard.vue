<template>
  <section class="min-w-0 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-600">
        Profit by time of day ({{ periodTitle }})
      </h2>
      <div
        class="relative z-0 inline-flex shrink-0 flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-0.5"
        role="group"
        aria-label="Profit by interval view"
      >
        <button
          type="button"
          class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          :class="viewMode === 'cards' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
          :aria-pressed="viewMode === 'cards'"
          title="Location cards"
          @click="viewMode = 'cards'"
        >
          <UIcon name="i-lucide-layout-grid" class="size-4" aria-hidden="true" />
          <span class="sr-only">Cards</span>
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          :class="viewMode === 'chart' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
          :aria-pressed="viewMode === 'chart'"
          title="Pie charts"
          @click="viewMode = 'chart'"
        >
          <UIcon name="i-lucide-chart-pie" class="size-4" aria-hidden="true" />
          <span class="sr-only">Pie charts</span>
        </button>
      </div>
    </div>

    <p class="text-[11px] leading-snug text-gray-500">
      {{ data.estimatesNote }}
      <span class="text-gray-400"> · </span>
      Each donut shows <span class="font-medium text-gray-700">profit by time of day</span> (Lunch, Afternoon, Dinner, Late Night) — slice colour is the interval; the
      <span class="font-medium text-gray-700">outer ring</span> is green when that location’s day profit is positive, red when negative.
      Lunch before 16:00 · Afternoon 16:00–18:00 · Dinner 18:00–22:00 · Late Night 22:00 until close.
    </p>

    <div
      v-show="viewMode === 'cards'"
      class="grid min-w-0 gap-4 lg:grid-cols-3"
    >
      <UCard
        v-for="loc in venueLocations"
        :key="loc.locationId!"
        class="border-2 border-gray-900 !bg-white ring-0 shadow-none"
      >
        <h3 class="text-lg font-semibold text-gray-900">{{ loc.label }}</h3>

        <div class="mt-4 space-y-4 text-xs text-gray-700">
          <div
            v-for="interval in DAILY_OPS_PROFIT_INTERVALS"
            :key="interval.key"
          >
            <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">
              {{ interval.label }}
            </p>
            <dl class="space-y-1">
              <div
                v-for="kpi in DAILY_OPS_PROFIT_INTERVAL_KPIS"
                :key="kpi.key"
                class="flex justify-between gap-2"
              >
                <dt class="text-gray-600">{{ kpi.label }}</dt>
                <dd
                  class="tabular-nums text-right font-medium"
                  :class="kpiProfitClass(loc.locationId!, interval.key, kpi.key)"
                >
                  {{ formatKpi(loc.locationId!, interval.key, kpi.key) }}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </UCard>
    </div>

    <div
      v-show="viewMode === 'chart'"
      class="rounded-lg border-2 border-gray-900 bg-white p-4"
    >
      <div class="grid min-w-0 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <DailyOpsProfitIntervalDonut
          v-for="panel in donutPanels"
          :key="panel.key"
          :title="panel.title"
          :total-profit="panel.totalProfit"
          :slices="panel.slices"
        />
      </div>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-600">
        <span class="inline-flex items-center gap-1.5">
          <span
            class="size-3 shrink-0 rounded-full border-2"
            :style="{ borderColor: statusRingColors.positive }"
          />
          Positive day profit (ring)
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span
            class="size-3 shrink-0 rounded-full border-2"
            :style="{ borderColor: statusRingColors.negative }"
          />
          Negative day profit (ring)
        </span>
        <span
          v-for="def in DAILY_OPS_PROFIT_INTERVALS"
          :key="def.key"
          class="inline-flex items-center gap-1.5"
        >
          <span
            class="size-2.5 shrink-0 rounded-full"
            :style="{ backgroundColor: intervalColors[def.key] }"
          />
          {{ def.label }} (slice)
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  DailyOpsPeriodId,
  DailyOpsProfitByIntervalDto,
  DailyOpsProfitIntervalKey,
} from '~/types/daily-ops-dashboard'
import {
  DAILY_OPS_PROFIT_INTERVALS,
  DAILY_OPS_PROFIT_INTERVAL_CHART_COLORS,
  DAILY_OPS_PROFIT_INTERVAL_KPIS,
  DAILY_OPS_PROFIT_STATUS_RING,
  DAILY_OPS_PROFIT_VENUE_LOCATIONS,
  type DailyOpsProfitIntervalKpiKey,
  type ProfitIntervalSlice,
} from '~/utils/dailyOpsProfitIntervals'

const statusRingColors = DAILY_OPS_PROFIT_STATUS_RING
const intervalColors = DAILY_OPS_PROFIT_INTERVAL_CHART_COLORS

const props = defineProps<{
  data: DailyOpsProfitByIntervalDto
  period: DailyOpsPeriodId
}>()

const { formatEur } = useDashboardEurFormat()

const viewMode = ref<'cards' | 'chart'>('chart')

const venueLocations = DAILY_OPS_PROFIT_VENUE_LOCATIONS

const periodTitle = computed(() => {
  if (props.period === 'today') return 'Today'
  if (props.period === 'yesterday') return 'Yesterday'
  if (props.period === 'this-week') return 'This week'
  if (props.period === 'last-week') return 'Last week'
  return props.period
})

const pieLocationDefs = [
  { key: 'all', locationId: null as string | null, title: 'All locations' },
  ...DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => ({
    key: v.locationId,
    locationId: v.locationId,
    title: v.label,
  })),
]

function kpiValue (
  locationId: string | null,
  intervalKey: DailyOpsProfitIntervalKey,
  kpiKey: DailyOpsProfitIntervalKpiKey
): number {
  return props.data.cells
    .filter(
      (c) =>
        (c.locationId ?? null) === locationId &&
        c.intervalKey === intervalKey &&
        props.data.dates.includes(c.date)
    )
    .reduce((sum, c) => sum + (c[kpiKey] ?? 0), 0)
}

function hasAnyData (locationId: string | null, intervalKey: DailyOpsProfitIntervalKey): boolean {
  return props.data.cells.some(
    (c) =>
      (c.locationId ?? null) === locationId &&
      c.intervalKey === intervalKey &&
      props.data.dates.includes(c.date)
  )
}

function kpiProfitClass (
  locationId: string | null,
  intervalKey: DailyOpsProfitIntervalKey,
  kpiKey: DailyOpsProfitIntervalKpiKey
): string {
  if (kpiKey !== 'profit') return 'text-gray-900'
  const v = kpiValue(locationId, intervalKey, 'profit')
  if (v > 0) return 'font-semibold text-[#5B9A6F]'
  if (v < 0) return 'font-semibold text-[#C97B7B]'
  return 'text-gray-500'
}

function formatKpi (
  locationId: string | null,
  intervalKey: DailyOpsProfitIntervalKey,
  kpiKey: DailyOpsProfitIntervalKpiKey
): string {
  const v = kpiValue(locationId, intervalKey, kpiKey)
  if (v === 0 && !hasAnyData(locationId, intervalKey)) return '—'
  return formatEur(v)
}

type DonutPanel = {
  key: string
  title: string
  totalProfit: number
  slices: ProfitIntervalSlice[]
}

const donutPanels = computed((): DonutPanel[] => {
  return pieLocationDefs.map((loc) => {
    const slices: ProfitIntervalSlice[] = DAILY_OPS_PROFIT_INTERVALS.map((def) => ({
      key: def.key,
      label: def.label,
      profit: kpiValue(loc.locationId, def.key, 'profit'),
      hasData: hasAnyData(loc.locationId, def.key),
    }))
    const totalProfit = slices.reduce((sum, s) => sum + s.profit, 0)
    return {
      key: loc.key,
      title: loc.title,
      totalProfit,
      slices,
    }
  })
})
</script>
