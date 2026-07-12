<template>
  <div v-if="digest" class="space-y-6">
    <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table class="min-w-full text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th class="px-4 py-3">Day</th>
            <th class="px-4 py-3 text-right">Revenue</th>
            <th class="px-4 py-3 text-right">vs prev week</th>
            <th class="px-4 py-3 text-right">% of week</th>
            <th class="px-4 py-3 text-right">Items</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in digest.dailyBreakdown" :key="row.businessDate" class="border-b border-gray-100">
            <td class="px-4 py-2 font-medium text-gray-900">
              {{ row.dayOfWeek }} <span class="text-gray-500">{{ row.businessDate }}</span>
            </td>
            <td class="px-4 py-2 text-right">{{ formatEur(row.revenue) }}</td>
            <td class="px-4 py-2 text-right" :class="deltaClass(row.prevWeekDeltaPct)">
              {{ formatPct(row.prevWeekDeltaPct) }}
            </td>
            <td class="px-4 py-2 text-right">{{ weekPct(row.revenue) }}%</td>
            <td class="px-4 py-2 text-right">{{ row.itemsCount.toLocaleString('nl-NL') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="mb-3 text-sm font-semibold text-gray-900">Revenue by day</p>
        <div class="flex h-32 items-end gap-1">
          <div
            v-for="row in digest.dailyBreakdown"
            :key="`bar-${row.businessDate}`"
            class="flex flex-1 flex-col items-center gap-1"
          >
            <div
              class="w-full rounded-t bg-gray-900"
              :style="{ height: `${barHeight(row.revenue)}%`, minHeight: row.revenue > 0 ? '4px' : '0' }"
            />
            <span class="text-[10px] text-gray-500">{{ row.dayOfWeek }}</span>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="mb-3 text-sm font-semibold text-gray-900">Category mix</p>
        <div class="space-y-2">
          <div v-for="cat in categoryRows" :key="cat.label">
            <div class="flex justify-between text-sm">
              <span>{{ cat.label }}</span>
              <span class="font-semibold">{{ cat.pct }}%</span>
            </div>
            <div class="h-2 rounded bg-gray-100">
              <div class="h-2 rounded bg-gray-900" :style="{ width: `${cat.pct}%` }" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WeeklyDigestDto } from '~/types/daily-ops-weekly-report'

const props = defineProps<{ digest: WeeklyDigestDto | null }>()
const { formatEur } = useDashboardEurFormat()

const maxRevenue = computed(() =>
  Math.max(...(props.digest?.dailyBreakdown.map((d) => d.revenue) ?? [1]), 1),
)

const categoryRows = computed(() => {
  const d = props.digest
  if (!d) return []
  const total = d.totals.revenue || 1
  return [
    { label: 'Food', value: d.totals.foodRevenue, pct: Math.round((d.totals.foodRevenue / total) * 100) },
    { label: 'Beverage', value: d.totals.beverageRevenue, pct: Math.round((d.totals.beverageRevenue / total) * 100) },
    {
      label: 'Other',
      value: Math.max(0, total - d.totals.foodRevenue - d.totals.beverageRevenue),
      pct: Math.round((Math.max(0, total - d.totals.foodRevenue - d.totals.beverageRevenue) / total) * 100),
    },
  ]
})

function barHeight(revenue: number): number {
  return Math.round((revenue / maxRevenue.value) * 100)
}

function weekPct(revenue: number): string {
  const total = props.digest?.totals.revenue ?? 0
  if (total <= 0) return '0'
  return String(Math.round((revenue / total) * 100))
}

function formatPct(v: number | null): string {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v}%`
}

function deltaClass(v: number | null): string {
  if (v == null) return 'text-gray-500'
  return v < 0 ? 'text-red-600' : 'text-green-700'
}
</script>
