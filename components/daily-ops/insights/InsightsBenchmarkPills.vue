<template>
  <div class="flex flex-col gap-1">
    <div class="flex flex-wrap items-center gap-1">
      <span class="mr-1 w-20 shrink-0 text-xs font-medium text-gray-500">Benchmark</span>
      <button
        v-for="opt in INSIGHTS_BENCHMARK_PROFILES"
        :key="opt.id"
        type="button"
        class="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
        :class="opt.id === modelValue
          ? 'border-amber-700 bg-amber-700 text-white'
          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'"
        :title="benchmarkSummaryLine(opt)"
        @click="select(opt.id)"
      >
        {{ opt.shortLabel }}
      </button>
      <a
        v-if="activeProfile.sourceUrl"
        :href="activeProfile.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="ml-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-gray-800"
      >
        Source
        <UIcon name="i-lucide-external-link" class="size-3" aria-hidden="true" />
      </a>
    </div>
    <p
      v-if="showMetricHint"
      class="pl-[5.25rem] text-[11px] leading-snug text-gray-500"
    >
      {{ metricHint }}
    </p>
  </div>
</template>

<script setup lang="ts">
import {
  INSIGHTS_BENCHMARK_PROFILES,
  benchmarkSummaryLine,
  type InsightsBenchmarkId,
} from '~/utils/dailyOpsInsightsNav/benchmarks'

const props = defineProps<{
  modelValue: InsightsBenchmarkId
  metricSupportsBenchmark?: boolean
  unsupportedMetricLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [id: InsightsBenchmarkId]
  select: [id: InsightsBenchmarkId]
}>()

const activeProfile = computed(() =>
  INSIGHTS_BENCHMARK_PROFILES.find((p) => p.id === props.modelValue) ?? INSIGHTS_BENCHMARK_PROFILES[0]!,
)

const showMetricHint = computed(() => props.metricSupportsBenchmark === false)

const metricHint = computed(() => {
  const label = props.unsupportedMetricLabel ?? 'this metric'
  return `Pick Staff %, COGS %, Net %, Staff costs, COGS (est.) or Net (est.) — amber benchmark line appears on those metrics, not ${label}.`
})

function select(id: InsightsBenchmarkId) {
  if (id === props.modelValue) return
  emit('update:modelValue', id)
  emit('select', id)
}
</script>
