/**
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-05-25T00:00:00.000Z
 * @description: Dashboard metrics via single snapshot bundle (ADR-004). One HTTP round-trip; progressive UI gates on summary only.
 * @last-fix: [2026-05-25] Replaced 3 parallel live-agg endpoints with /metrics/bundle snapshot read.
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsHomeDashboard.vue
 * ✓ components/daily-ops/DailyOpsTodayRevenueCard.vue
 * ✓ components/daily-ops/DailyOpsProductivityLaborSection.vue
 * ✓ components/daily-ops/DailyOpsRevenueMetricsSection.vue (via useDailyOpsRevenueBreakdown)
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
  /** True while bundle request in flight */
  pending: boolean
  /** True until summary slice is available (KPIs / header can render) */
  summaryPending: boolean
  error: unknown
  refresh: () => Promise<void>
}

type DashboardBundleResponse = {
  summary: DailyOpsSummaryDto
  revenue: DailyOpsRevenueBreakdownDto
  labor: DailyOpsLaborMetricsDto
}

const metricsKey = (q: Record<string, string | undefined>): string =>
  `daily-ops-bundle-${q.period ?? 'today'}-${q.location ?? 'all'}-${q.anchor ?? ''}`

export function useDailyOpsDashboardMetrics(): DailyOpsDashboardMetrics {
  const { dashboardQuery } = useDailyOpsDashboardRoute()
  const cacheKey = computed(() => metricsKey(dashboardQuery.value))

  const { data: bundle, pending, error, refresh } = useAsyncData(
    cacheKey,
    () =>
      $fetch<DashboardBundleResponse>('/api/daily-ops/metrics/bundle', {
        query: dashboardQuery.value,
      }),
    { watch: [cacheKey] }
  )

  const summary = computed(() => bundle.value?.summary ?? null)
  const revenue = computed(() => bundle.value?.revenue ?? null)
  const labor = computed(() => bundle.value?.labor ?? null)
  const summaryPending = computed(() => pending.value || !summary.value)

  return {
    summary,
    revenue,
    labor,
    pending,
    summaryPending,
    error,
    refresh,
  }
}

/** Shares the same bundle cache key as useDailyOpsDashboardMetrics (no extra request). */
export function useDailyOpsLaborMetrics() {
  const { labor, pending, error, refresh } = useDailyOpsDashboardMetrics()
  return {
    labor,
    pending,
    error,
    refresh,
  }
}

/** Shares the same bundle cache key as useDailyOpsDashboardMetrics (no extra request). */
export function useDailyOpsRevenueBreakdown() {
  const { revenue, pending, error, refresh } = useDailyOpsDashboardMetrics()
  return {
    revenue,
    pending,
    error,
    refresh,
  }
}
