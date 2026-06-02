<template>
  <UCard
    class="border-2 !bg-white ring-0 shadow-none"
    :class="cardClass"
    :style="borderStyle"
  >
    <h3 class="text-lg font-semibold text-gray-900">{{ label }}</h3>

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
              :class="kpiProfitClass(interval.key, kpi.key)"
            >
              {{ formatKpi(interval.key, kpi.key) }}
            </dd>
          </div>
        </dl>
      </div>

      <div class="border-t-2 border-gray-200 pt-4">
        <p class="mb-2 text-xs font-bold uppercase tracking-wide text-gray-900">
          Total P&amp;L ({{ periodTitle }})
        </p>
        <dl class="space-y-1">
          <div
            v-for="kpi in DAILY_OPS_PROFIT_INTERVAL_KPIS"
            :key="`total-${locationId}-${kpi.key}`"
            class="flex justify-between gap-2"
          >
            <dt class="text-gray-600">{{ kpi.label }}</dt>
            <dd
              class="tabular-nums text-right font-medium"
              :class="locationTotalKpiClass(kpi.key)"
            >
              {{ formatLocationTotalKpi(kpi.key) }}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type {
  DailyOpsProfitByIntervalDto,
  DailyOpsProfitIntervalKey,
} from '~/types/daily-ops-dashboard'
import {
  DAILY_OPS_PROFIT_INTERVALS,
  DAILY_OPS_PROFIT_INTERVAL_KPIS,
  type DailyOpsProfitIntervalKpiKey,
} from '~/utils/dailyOpsProfitIntervals'

const props = defineProps<{
  locationId: string
  label: string
  periodTitle: string
  data: DailyOpsProfitByIntervalDto
  cardClass?: string
}>()

const { formatEur } = useDashboardEurFormat()
const { chartColorFor } = useDailyOpsLocationChartColors()

const borderStyle = computed(() => ({ borderColor: chartColorFor(props.locationId) }))

function kpiValue (
  intervalKey: DailyOpsProfitIntervalKey,
  kpiKey: DailyOpsProfitIntervalKpiKey
): number {
  const cells = props.data?.cells ?? []
  const dates = props.data?.dates ?? []
  return cells
    .filter(
      (c) =>
        c.locationId === props.locationId &&
        c.intervalKey === intervalKey &&
        dates.includes(c.date),
    )
    .reduce((sum, c) => sum + (c[kpiKey] ?? 0), 0)
}

function locationDayLoadedLabor (): number {
  const dates = props.data?.dates ?? []
  const seen = new Set<string>()
  let sum = 0
  for (const c of props.data?.cells ?? []) {
    if (c.locationId !== props.locationId || !dates.includes(c.date)) continue
    if (seen.has(c.date)) continue
    seen.add(c.date)
    sum += c.dayLoadedLabor ?? 0
  }
  return sum
}

function locationTotalKpi (kpiKey: DailyOpsProfitIntervalKpiKey): number {
  if (kpiKey === 'laborCost') return locationDayLoadedLabor()
  if (kpiKey === 'profit') {
    return (
      locationTotalKpi('revenue')
      - locationDayLoadedLabor()
      - locationTotalKpi('cogsCost')
      - locationTotalKpi('fixedCost')
    )
  }
  return DAILY_OPS_PROFIT_INTERVALS.reduce(
    (sum, def) => sum + kpiValue(def.key, kpiKey),
    0,
  )
}

function hasAnyLocationData (): boolean {
  return (props.data?.cells ?? []).some(
    (c) =>
      c.locationId === props.locationId &&
      (props.data?.dates ?? []).includes(c.date),
  )
}

function hasAnyIntervalData (intervalKey: DailyOpsProfitIntervalKey): boolean {
  return (props.data?.cells ?? []).some(
    (c) =>
      c.locationId === props.locationId &&
      c.intervalKey === intervalKey &&
      (props.data?.dates ?? []).includes(c.date),
  )
}

function kpiProfitClass (
  intervalKey: DailyOpsProfitIntervalKey,
  kpiKey: DailyOpsProfitIntervalKpiKey
): string {
  if (kpiKey !== 'profit') return 'text-gray-900'
  const v = kpiValue(intervalKey, 'profit')
  if (v > 0) return 'font-semibold text-[#5B9A6F]'
  if (v < 0) return 'font-semibold text-[#C97B7B]'
  return 'text-gray-500'
}

function formatKpi (
  intervalKey: DailyOpsProfitIntervalKey,
  kpiKey: DailyOpsProfitIntervalKpiKey
): string {
  const v = kpiValue(intervalKey, kpiKey)
  if (v === 0 && !hasAnyIntervalData(intervalKey)) return '—'
  return formatEur(v)
}

function locationTotalKpiClass (kpiKey: DailyOpsProfitIntervalKpiKey): string {
  if (kpiKey !== 'profit') return 'text-gray-900'
  const v = locationTotalKpi('profit')
  if (v > 0) return 'font-semibold text-[#5B9A6F]'
  if (v < 0) return 'font-semibold text-[#C97B7B]'
  return 'text-gray-500'
}

function formatLocationTotalKpi (kpiKey: DailyOpsProfitIntervalKpiKey): string {
  const v = locationTotalKpi(kpiKey)
  if (v === 0 && !hasAnyLocationData()) return '—'
  return formatEur(v)
}
</script>
