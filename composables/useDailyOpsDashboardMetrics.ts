/**
 * @registry-id: useDailyOpsDashboardMetrics
 * @created: 2026-05-18T00:00:00.000Z
 * @last-modified: 2026-07-22T00:00:00.000Z
 * @description: Dashboard metrics via single snapshot bundle (ADR-004). One HTTP round-trip; progressive UI gates on summary only.
 * @last-fix: [2026-07-22] Expose sealed tableOccupancy from dashboard-bundle
 *   Prior: [2026-07-16] Restore stable asyncData key — default:null + getter key emptied all Daily Ops pages
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: dashboard-bundle (via GET /api/daily-ops/metrics/bundle)
 * @imports-data-from: GET /api/daily-ops/metrics/bundle
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsHomeDashboard.vue
 * ✓ components/daily-ops/DailyOpsTodayRevenueCard.vue
 * ✓ components/daily-ops/DailyOpsProductivityLaborSection.vue
 * ✓ components/daily-ops/DailyOpsRevenueMetricsSection.vue
 * ✓ pages/daily-ops/index.vue
 */
import type {
  DailyOpsLaborMetricsDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
  PeriodBreakdownDto,
} from '~/types/daily-ops-dashboard'
import type { DailyOpsTableOccupancyKpisDto } from '~/types/daily-ops-venue-tables'
import type { ComputedRef, Ref } from 'vue'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { pollWindowState } from '~/utils/integrations/borkEitjeDailyCronSchedule'

export type DailyOpsDashboardMetrics = {
  summary: ComputedRef<DailyOpsSummaryDto | null>
  revenue: ComputedRef<DailyOpsRevenueBreakdownDto | null>
  labor: ComputedRef<DailyOpsLaborMetricsDto | null>
  periodBreakdown: ComputedRef<PeriodBreakdownDto | null>
  tableOccupancy: ComputedRef<DailyOpsTableOccupancyKpisDto | null>
  pending: Ref<boolean>
  summaryPending: ComputedRef<boolean>
  error: Ref<unknown>
  refresh: () => Promise<void>
}

type DashboardBundleResponse = {
  summary: DailyOpsSummaryDto
  revenue: DailyOpsRevenueBreakdownDto
  labor: DailyOpsLaborMetricsDto
  periodBreakdown?: PeriodBreakdownDto
  tableOccupancy?: DailyOpsTableOccupancyKpisDto
}

type SnapshotVersionResponse = {
  businessDate: string
  lastBuiltAt: string | null
}

const POLL_INTERVAL_MS = 30_000
const SNAPSHOT_BUILT_AT_STATE = 'daily-ops-bundle-snapshot-built-at'

const metricsKey = (
  q: Record<string, string | undefined>,
  snapshotBuiltAt: string | null,
): string => {
  const base = `daily-ops-bundle-v6-${q.period ?? 'today'}-${q.location ?? 'all'}-${q.anchor ?? ''}`
  if ((q.period ?? 'today') === 'today') {
    return `${base}-${amsterdamOpenRegisterBusinessDateYmd()}-${snapshotBuiltAt ?? 'init'}`
  }
  return base
}

export function useDailyOpsDashboardMetrics(): DailyOpsDashboardMetrics {
  const { dashboardQuery, period } = useDailyOpsDashboardRoute()

  const snapshotBuiltAt = useState<string | null>(SNAPSHOT_BUILT_AT_STATE, () => null)
  const cacheKey = computed(() => metricsKey(dashboardQuery.value, snapshotBuiltAt.value))

  const { data: bundle, pending, error, refresh } = useAsyncData(
    'daily-ops-dashboard-bundle',
    () =>
      $fetch<DashboardBundleResponse>('/api/daily-ops/metrics/bundle', {
        query: dashboardQuery.value,
      }),
    { watch: [cacheKey] },
  )

  const summary = computed(() => bundle.value?.summary ?? null)
  const revenue = computed(() => bundle.value?.revenue ?? null)
  const labor = computed(() => bundle.value?.labor ?? null)
  const periodBreakdown = computed(() => bundle.value?.periodBreakdown ?? null)
  const tableOccupancy = computed(() => bundle.value?.tableOccupancy ?? null)
  const summaryPending = computed(() => pending.value || !summary.value)

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
    periodBreakdown,
    tableOccupancy,
    pending,
    summaryPending,
    error,
    refresh,
  }
}

export function useDailyOpsLaborMetrics() {
  const { labor, pending, error, refresh } = useDailyOpsDashboardMetrics()
  return { labor, pending, error, refresh }
}

export function useDailyOpsRevenueBreakdown() {
  const { revenue, pending, error, refresh } = useDailyOpsDashboardMetrics()
  return { revenue, pending, error, refresh }
}
