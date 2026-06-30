/**
 * @registry-id: useDailyOpsInsightsMetrics
 * @created: 2026-06-30T20:00:00.000Z
 * @last-modified: 2026-06-30T20:00:00.000Z
 * @description: Insights page fetch — monthly/yearly mode + slot
 * @last-fix: [2026-06-25] Benchmark client-only — not in API query
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ components/daily-ops/insights/DailyOpsPerformanceInsights.vue
 */

import type { DailyOpsPerformanceInsightsDto } from '~/types/daily-ops-insights'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import {
  coerceInsightsBenchmarkId,
  insightsBenchmarkById,
  type InsightsBenchmarkId,
} from '~/utils/dailyOpsInsightsNav/benchmarks'

export function useDailyOpsInsightsMetrics() {
  const route = useRoute()
  const router = useRouter()

  const anchor = computed(() => amsterdamOpenRegisterBusinessDateYmd())

  const locationId = computed(() => {
    const l = route.query.location
    return typeof l === 'string' && l.length > 0 ? l : null
  })

  const benchmarkId = useState<InsightsBenchmarkId>('daily-ops-insights-benchmark', () =>
    coerceInsightsBenchmarkId(typeof route.query.benchmark === 'string' ? route.query.benchmark : undefined),
  )

  watch(
    () => route.query.benchmark,
    (raw) => {
      const next = coerceInsightsBenchmarkId(typeof raw === 'string' ? raw : undefined)
      if (next !== benchmarkId.value) benchmarkId.value = next
    },
  )

  const insightsQuery = computed(() => {
    const q: Record<string, string> = {
      mode: typeof route.query.mode === 'string' ? route.query.mode : 'monthly',
      slot: typeof route.query.slot === 'string' ? route.query.slot : 'last-month',
      anchor: anchor.value,
    }
    if (locationId.value) q.location = locationId.value
    return q
  })

  const benchmark = computed(() => insightsBenchmarkById(benchmarkId.value))

  function setBenchmarkId(id: InsightsBenchmarkId) {
    if (id === benchmarkId.value) return
    benchmarkId.value = id
    router.replace({
      query: { ...route.query, benchmark: id },
    })
  }

  const { data, pending, error } = useFetch<DailyOpsPerformanceInsightsDto>('/api/daily-ops/insights', {
    query: insightsQuery,
  })

  return {
    data,
    pending,
    error,
    insightsQuery,
    locationId,
    benchmarkId,
    benchmark,
    setBenchmarkId,
  }
}
