/**
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-06-08T00:00:00.000Z
 * @description: Dashboard metrics via single snapshot bundle (ADR-004). One HTTP round-trip; progressive UI gates on summary only.
 * @last-fix: [2026-06-08] Snapshot-version poll replaces cron-hour cache guessing and illegal GET patch.
 *   Poll activates only 4–10 min after a scheduled cron hour; stops immediately on lastBuiltAt advance.
 *   Prior: [2026-06-07] Cache invalidation follows per-weekday Bork/Eitje cron SSOT
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
import { pollWindowState } from '~/utils/integrations/borkEitjeDailyCronSchedule'

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

type SnapshotVersionResponse = {
  businessDate: string
  lastBuiltAt: string | null
}

const POLL_INTERVAL_MS = 30_000

const metricsKey = (
  q: Record<string, string | undefined>,
  snapshotBuiltAt: string | null,
): string => {
  const base = `daily-ops-bundle-v2-${q.period ?? 'today'}-${q.location ?? 'all'}-${q.anchor ?? ''}`
  if ((q.period ?? 'today') === 'today') {
    return `${base}-${amsterdamOpenRegisterBusinessDateYmd()}-${snapshotBuiltAt ?? 'init'}`
  }
  return base
}

export function useDailyOpsDashboardMetrics(): DailyOpsDashboardMetrics {
  const { dashboardQuery, period } = useDailyOpsDashboardRoute()

  /** lastBuiltAt drives the cache key — advances when snapshot is rebuilt post-cron. */
  const snapshotBuiltAt = ref<string | null>(null)

  const cacheKey = computed(() => metricsKey(dashboardQuery.value, snapshotBuiltAt.value))

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

  /** Snapshot version polling — only active on today view, only in the 4–10 min cron window. */
  if (import.meta.client) {
    let pollTimer: ReturnType<typeof setInterval> | null = null

    function stopPoll() {
      if (pollTimer !== null) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    async function checkSnapshotVersion() {
      const win = pollWindowState()
      if (!win.active || win.cronStartedAtMs === null) {
        stopPoll()
        return
      }

      try {
        const res = await $fetch<SnapshotVersionResponse>(
          '/api/daily-ops/metrics/snapshot-version',
          { query: dashboardQuery.value },
        )

        if (
          res.lastBuiltAt &&
          win.cronStartedAtMs !== null &&
          new Date(res.lastBuiltAt).getTime() > win.cronStartedAtMs
        ) {
          snapshotBuiltAt.value = res.lastBuiltAt
          stopPoll()
        }
      } catch {
        // Silent — ops notifications handle cron/snapshot failures
      }
    }

    function startPollIfNeeded() {
      if (period.value !== 'today') return
      const win = pollWindowState()
      if (!win.active) return
      if (pollTimer !== null) return
      pollTimer = setInterval(checkSnapshotVersion, POLL_INTERVAL_MS)
    }

    onMounted(() => {
      startPollIfNeeded()
      // Re-evaluate at each minute tick (cheap; just checks Amsterdam minute)
      const minuteTick = setInterval(startPollIfNeeded, 60_000)
      onUnmounted(() => {
        stopPoll()
        clearInterval(minuteTick)
      })
    })
  }

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
  return { labor, pending, error, refresh }
}

/** Shares the same bundle cache key as useDailyOpsDashboardMetrics (no extra request). */
export function useDailyOpsRevenueBreakdown() {
  const { revenue, pending, error, refresh } = useDailyOpsDashboardMetrics()
  return { revenue, pending, error, refresh }
}
