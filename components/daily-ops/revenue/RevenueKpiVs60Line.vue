<template>
  <p class="mt-1 text-xs font-medium" :class="metric.above ? 'text-green-700' : 'text-red-600'">
    <span>{{ metric.above ? '▲' : '▼' }}</span>
    {{ metric.above ? '+' : '' }}{{ formatDelta }}
    <span v-if="metric.pct != null"> ({{ metric.pct >= 0 ? '+' : '' }}{{ metric.pct }}%)</span>
    <span class="text-gray-500"> vs {{ benchmarkLabel }}</span>
  </p>
</template>

<script setup lang="ts">
import type { DailyOpsRevenueKpiVsBenchmark } from '~/types/daily-ops-revenue'

const props = defineProps<{
  metric: DailyOpsRevenueKpiVsBenchmark
  benchmarkLabel: string
  format?: 'eur' | 'number' | 'eurPerItem'
}>()

const { formatEur } = useDashboardEurFormat()

const formatDelta = computed(() => {
  const d = props.metric.delta
  if (props.format === 'number') return d.toLocaleString('nl-NL')
  if (props.format === 'eurPerItem') return formatEur(d)
  return formatEur(d)
})
</script>
