<template>
  <section class="rounded-lg border-2 border-gray-900 bg-white p-4">
    <div class="mb-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Bezettingsgraad</h2>
      <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900">{{ headlinePct }}</p>
      <p v-if="data?.avgMonthlyOccupancyPct != null" class="mt-0.5 text-xs text-gray-500">
        Avg monthly: {{ formatPct(data.avgMonthlyOccupancyPct) }}
      </p>
      <p class="mt-0.5 text-xs text-gray-500">
        {{ subtitle }}
      </p>
    </div>

    <div v-if="!points.length" class="py-10 text-center text-sm text-gray-500">
      Rebuild dashboard-bundle cache to seal occupancy for this period.
    </div>
    <div v-else class="flex h-48 items-end gap-1 overflow-x-auto pb-6">
      <div
        v-for="p in points"
        :key="p.key"
        class="flex min-w-[2rem] flex-1 flex-col items-center justify-end"
        :title="`${p.label}: ${formatPct(p.occupancyPct)}`"
      >
        <span class="mb-1 text-[10px] tabular-nums text-gray-600">{{ formatPctShort(p.occupancyPct) }}</span>
        <div
          class="w-full max-w-[2.5rem] rounded-t bg-gray-900"
          :style="{ height: `${barHeight(p.occupancyPct)}%` }"
        />
        <span class="mt-1 max-w-[3rem] truncate text-[10px] text-gray-500">{{ p.label }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * @description: Bezettingsgraad chart — grain follows top period nav (no local selector)
 * @last-modified: 2026-07-22T01:05:00.000Z
 * @last-fix: [2026-07-22] Below Profit by TOD; day→hour week→day month→week year→month
 * @adr-ref: ADR-013
 * @data-source: read-cache
 * @read-cache-json: dashboard-bundle.tableOccupancy.series
 */
import type {
  DailyOpsOccupancyGrain,
  DailyOpsTableOccupancyKpisDto,
} from '~/types/daily-ops-venue-tables'
import { DAILY_OPS_RANGE_PERIOD_IDS } from '~/types/daily-ops-dashboard'

const props = defineProps<{
  data?: DailyOpsTableOccupancyKpisDto | null
  period: string
}>()

/** Top-nav period → sealed series grain (matches period-breakdown pattern). */
function grainForPeriod(period: string): DailyOpsOccupancyGrain {
  if (period === 'this-year' || period === 'last-year' || period === 'year') return 'month'
  if (period === 'this-month' || period === 'last-month' || period === 'month') return 'week'
  if (period === 'this-week' || period === 'last-week' || period === 'week') return 'day'
  if ((DAILY_OPS_RANGE_PERIOD_IDS as readonly string[]).includes(period)) {
    // other multi-day ranges default to day buckets
    return 'day'
  }
  // today / yesterday / d2–d7
  return 'hour'
}

const grain = computed(() => grainForPeriod(props.period))

const grainLabel = computed(() => {
  switch (grain.value) {
    case 'hour': return 'by hour'
    case 'day': return 'by day'
    case 'week': return 'by week'
    case 'month': return 'by month'
    default: return grain.value
  }
})

const points = computed(() => props.data?.series?.[grain.value] ?? [])

const headlinePct = computed(() => formatPct(props.data?.occupancyPct ?? null))

const subtitle = computed(() => {
  if (!props.data) return 'No sealed occupancy in cache yet'
  return `${formatActive(props.data.activeTables)} / ${props.data.totalTables} tables · ${grainLabel.value}`
})

function formatPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${Math.round(n)}%`
}

function formatPctShort(n: number | null | undefined): string {
  if (n == null) return ''
  return `${Math.round(n)}`
}

function formatActive(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function barHeight(pct: number | null | undefined): number {
  if (pct == null || pct <= 0) return 2
  return Math.min(100, Math.max(4, pct))
}
</script>
