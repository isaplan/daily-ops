/**
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-05-18T00:00:00.000Z
 * @description: Parallel dashboard metrics (summary + revenue + labor); replaces monolithic bundle fetch.
 * @last-fix: [2026-05-18] Split bundle into per-slice APIs for modular cards and faster HMR.
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsHomeDashboard.vue
 * ✓ components/daily-ops/DailyOpsTodayRevenueCard.vue
 * ✓ components/daily-ops/DailyOpsProductivityLaborSection.vue
 */
import type {
  DailyOpsLaborMetricsDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
} from '~/types/daily-ops-dashboard'

export type DailyOpsDashboardMetrics = {
  summary: DailyOpsSummaryDto | null
  revenue: DailyOpsRevenueBreakdownDto | null
  labor: DailyOpsLaborMetricsDto | null
  pending: boolean
  error: unknown
  refresh: () => Promise<void>
}

const metricsKey = (q: Record<string, string | undefined>): string =>
  `daily-ops-metrics-${q.period ?? 'today'}-${q.location ?? 'all'}-${q.anchor ?? ''}`

export function useDailyOpsDashboardMetrics(): DailyOpsDashboardMetrics {
  const { dashboardQuery } = useDailyOpsDashboardRoute()

  const cacheKey = computed(() => metricsKey(dashboardQuery.value))

  const summaryKey = computed(() => `${cacheKey.value}-summary`)
  const revenueKey = computed(() => `${cacheKey.value}-revenue`)
  const laborKey = computed(() => `${cacheKey.value}-labor`)

  const { data: summaryData, pending: summaryPending, error: summaryError, refresh: refreshSummary } =
    useAsyncData(
      summaryKey,
      () =>
        $fetch<DailyOpsSummaryDto>('/api/daily-ops/metrics/summary', {
          query: dashboardQuery.value,
        }),
      { watch: [cacheKey] }
    )

  const { data: revenueData, pending: revenuePending, error: revenueError, refresh: refreshRevenue } =
    useAsyncData(
      revenueKey,
      () =>
        $fetch<DailyOpsRevenueBreakdownDto>('/api/daily-ops/metrics/revenue-breakdown', {
          query: dashboardQuery.value,
        }),
      { watch: [cacheKey] }
    )

  const { data: laborData, pending: laborPending, error: laborError, refresh: refreshLabor } =
    useAsyncData(
      laborKey,
      () =>
        $fetch<DailyOpsLaborMetricsDto>('/api/daily-ops/metrics/labor', {
          query: dashboardQuery.value,
        }),
      { watch: [cacheKey] }
    )

  const summary = computed(() => summaryData.value ?? null)
  const revenue = computed(() => revenueData.value ?? null)
  const labor = computed(() => laborData.value ?? null)

  const pending = computed(
    () => summaryPending.value || revenuePending.value || laborPending.value
  )

  const error = computed(() => summaryError.value ?? revenueError.value ?? laborError.value)

  const refresh = async (): Promise<void> => {
    await Promise.all([refreshSummary(), refreshRevenue(), refreshLabor()])
  }

  return { summary, revenue, labor, pending, error, refresh }
}

/** Labor-only fetch for productivity section (dedupes with dashboard when same query). */
export function useDailyOpsLaborMetrics() {
  const { dashboardQuery } = useDailyOpsDashboardRoute()
  const cacheKey = computed(() => `${metricsKey(dashboardQuery.value)}-labor`)

  const { data, pending, error, refresh } = useAsyncData(
    cacheKey,
    () =>
      $fetch<DailyOpsLaborMetricsDto>('/api/daily-ops/metrics/labor', {
        query: dashboardQuery.value,
      }),
    { watch: [cacheKey] }
  )

  return {
    labor: computed(() => data.value ?? null),
    pending,
    error,
    refresh,
  }
}

/** Revenue-only fetch for revenue cards (dedupes with dashboard when same query). */
export function useDailyOpsRevenueMetrics() {
  const { dashboardQuery } = useDailyOpsDashboardRoute()
  const cacheKey = computed(() => `${metricsKey(dashboardQuery.value)}-revenue`)

  const { data, pending, error, refresh } = useAsyncData(
    cacheKey,
    () =>
      $fetch<DailyOpsRevenueBreakdownDto>('/api/daily-ops/metrics/revenue-breakdown', {
        query: dashboardQuery.value,
      }),
    { watch: [cacheKey] }
  )

  return {
    revenue: computed(() => data.value ?? null),
    pending,
    error,
    refresh,
  }
}
