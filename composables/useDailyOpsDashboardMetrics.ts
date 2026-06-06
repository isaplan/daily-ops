/**
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-06-06T17:15:00.000Z
 * @description: Dashboard metrics via single snapshot bundle (ADR-004). One HTTP round-trip; progressive UI gates on summary only.
 * @last-fix: [2026-06-06] Smart cache invalidation: refresh only after cron runs (01,08,15,18-23h + Fri/Sat 02h), then cache for 1h
 *   Prior: [2026-05-25] Replaced 3 parallel live-agg endpoints with /metrics/bundle snapshot read.
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
import type { ComputedRef, Ref } from 'vue'

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
  
  // For 'today', invalidate cache based on cron schedule
  if ((q.period ?? 'today') === 'today') {
    const now = new Date()
    const hour = now.getHours()
    
    // Cache until next expected cron run: 01,08,15,18,19,20,21,22,23 + Fri/Sat 02:00
    const cronHours = [1, 8, 15, 18, 19, 20, 21, 22, 23]
    const isFriSat = now.getDay() === 5 || now.getDay() === 6 // Friday=5, Saturday=6
    if (isFriSat) cronHours.push(2)
    
    // Find next cron hour (or tomorrow's first cron)
    const nextCronHour = cronHours.find(h => h > hour) || (cronHours[0] + 24)
    
    // Cache window: current hour if cron expected, otherwise until next cron
    const cacheWindow = cronHours.includes(hour) ? `${hour}` : `until-${nextCronHour}`
    
    return `${base}-${now.toISOString().slice(0, 10)}-${cacheWindow}`
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
