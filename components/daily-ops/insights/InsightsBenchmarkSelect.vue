<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="inline-flex shrink-0 items-center gap-1.5 rounded-md border-2 border-gray-900 bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="open = !open"
    >
      <span class="text-gray-500">Benchmark</span>
      <span>{{ activeProfile.shortLabel }}</span>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-4 text-gray-500 transition-transform"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      />
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,22rem)] rounded-md border-2 border-gray-900 bg-white py-1 shadow-lg"
      role="listbox"
      :aria-label="`Benchmark: ${activeProfile.label}`"
    >
      <button
        v-for="opt in INSIGHTS_BENCHMARK_PROFILES"
        :key="opt.id"
        type="button"
        role="option"
        class="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-gray-50"
        :class="opt.id === activeId ? 'bg-gray-50' : ''"
        :aria-selected="opt.id === activeId"
        @click="select(opt.id)"
      >
        <span class="text-sm font-semibold text-gray-900">{{ opt.label }}</span>
        <span class="text-xs text-gray-600">{{ benchmarkSummaryLine(opt) }}</span>
        <span class="text-[11px] leading-snug text-gray-500">{{ opt.description }}</span>
      </button>

      <div
        v-if="activeProfile.sourceUrl"
        class="border-t border-gray-200 px-3 py-2"
      >
        <a
          :href="activeProfile.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 underline decoration-gray-400 underline-offset-2 hover:text-gray-900"
          @click.stop
        >
          {{ activeProfile.sourceLabel }}
          <UIcon name="i-lucide-external-link" class="size-3.5" aria-hidden="true" />
        </a>
      </div>
      <p
        v-else
        class="border-t border-gray-200 px-3 py-2 text-xs text-gray-500"
      >
        {{ activeProfile.sourceLabel }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  INSIGHTS_BENCHMARK_PROFILES,
  benchmarkSummaryLine,
  coerceInsightsBenchmarkId,
  type InsightsBenchmarkId,
} from '~/utils/dailyOpsInsightsNav/benchmarks'

const route = useRoute()
const router = useRouter()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const activeId = computed(() =>
  coerceInsightsBenchmarkId(typeof route.query.benchmark === 'string' ? route.query.benchmark : undefined),
)

const activeProfile = computed(() =>
  INSIGHTS_BENCHMARK_PROFILES.find((p) => p.id === activeId.value) ?? INSIGHTS_BENCHMARK_PROFILES[0]!,
)

function select(id: InsightsBenchmarkId) {
  open.value = false
  if (id === activeId.value) return
  router.push({
    query: { ...route.query, benchmark: id },
  })
}

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return
  const el = rootRef.value
  if (el && !el.contains(e.target as Node)) open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  if (typeof route.query.benchmark !== 'string') {
    router.replace({ query: { ...route.query, benchmark: activeId.value } })
  }
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>
