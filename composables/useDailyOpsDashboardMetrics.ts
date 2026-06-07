/**
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-06-07T00:00:00.000Z
 * @description: Dashboard metrics via single snapshot bundle (ADR-004). One HTTP round-trip; progressive UI gates on summary only.
 * @last-fix: [2026-06-07] Cache invalidation follows per-weekday Bork/Eitje cron SSOT
 *   Prior: [2026-06-07] Cache key uses open register business_date (ADR-010)
 * @adr-ref: ADR-004, ADR-010
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
import type { ComputedRef, Ref } from 'vue'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { dailyCronCacheWindowKey } from '~/utils/integrations/borkEitjeDailyCronSchedule'

export type DailyOpsDashboardMetrics = {
  summary: ComputedRef<DailyOpsSummaryDto | null>
  revenue: ComputedRef<DailyOpsRevenueBreakdownDto | null>
  labor: ComputedRef<DailyOpsLaborMetricsDto | null>
  /** True while bundle request in flight */
  pending: Ref<boolean>
  /** True until summary slice is available (KPIs / header can render) */
  summaryPending: ComputedRef<boolean>
  error: Ref<unknown>
  refresh: () => Promise<void>
}

type DashboardBundleResponse = {
  summary: DailyOpsSummaryDto
  revenue: DailyOpsRevenueBreakdownDto
  labor: DailyOpsLaborMetricsDto
}

const metricsKey = (q: Record<string, string | undefined>): string => {
  const base = `daily-ops-bundle-v2-${q.period ?? 'today'}-${q.location ?? 'all'}-${q.anchor ?? ''}`

  if ((q.period ?? 'today') === 'today') {
    return `${base}-${amsterdamOpenRegisterBusinessDateYmd()}-${dailyCronCacheWindowKey()}`
  }

  return base
}

export function useDailyOpsDashboardMetrics(): DailyOpsDashboardMetrics {
  const { dashboardQuery } = useDailyOpsDashboardRoute()
  const cacheKey = computed(() => metricsKey(dashboardQuery.value))

  const { data: bundle, pending, error, refresh } = useAsyncData(
    cacheKey,
    () =>
      $fetch<DashboardBundleResponse>('/api/daily-ops/metrics/bundle', {
        query: dashboardQuery.value,
      }),
    { watch: [cacheKey] },
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
