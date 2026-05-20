<template>
  <div v-if="summary" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div class="flex items-start justify-between gap-2">
        <p class="text-xs font-semibold uppercase text-gray-500">Omzet</p>
        <span
          v-if="leadLabel"
          class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600"
        >
          {{ leadLabel }}
        </span>
      </div>
      <p class="text-2xl font-bold">{{ formatEur(summary.revenue) }}</p>
      <DailyOpsRevenueDeltaBadge v-if="summary.compareDelta" :delta="summary.compareDelta" />
    </div>
    <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p class="text-xs font-semibold uppercase text-gray-500">Stuks</p>
      <p class="text-2xl font-bold">{{ summary.itemsCount.toLocaleString('nl-NL') }}</p>
    </div>
    <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p class="text-xs font-semibold uppercase text-gray-500">€ / stuk</p>
      <p class="text-2xl font-bold">{{ formatEur(summary.revenuePerItem) }}</p>
    </div>
    <div v-if="summary.compareLabel" class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p class="text-xs font-semibold uppercase text-gray-500">Vergelijking</p>
      <p class="text-sm font-medium text-gray-800">{{ summary.compareLabel }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DailyOpsRevenueKpiDto } from '~/types/daily-ops-revenue'

const props = defineProps<{ summary: DailyOpsRevenueKpiDto | null }>()
const { formatEur } = useDashboardEurFormat()

const leadLabel = computed(() => {
  const s = props.summary?.leadSource
  if (s === 'inbox_basis') return 'Basis'
  if (s === 'bork_api') return 'Bork'
  return s === 'unknown' ? null : s
})
</script>
