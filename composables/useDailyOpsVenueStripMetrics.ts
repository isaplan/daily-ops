/**
 * @registry-id: useDailyOpsVenueStripMetrics
 * @created: 2026-08-16T14:20:00.000Z
 * @last-modified: 2026-08-16T15:55:00.000Z
 * @description: Shared venue-strip GET — one HTTP for KPI tiles + VenueStrip + client session cache
 * @last-fix: [2026-08-16] Client session cache with Today/week/archive freshness
 * @adr-ref: ADR-004, ADR-013
 * @data-source: read-cache | snapshot-today-live | client-session
 * @read-cache-json: venue-strip via GET /api/daily-ops/metrics/venue-strip
 * @imports-data-from: GET /api/daily-ops/metrics/venue-strip
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 * ✓ components/daily-ops/DailyOpsVenueStrip.vue
 * ✓ components/daily-ops/DailyOpsHomeDashboard.vue
 */

import type { VenueStripCardDto, VenueStripResponseDto } from '~/types/daily-ops-dashboard'
import type { ComputedRef, Ref } from 'vue'
import { useDailyOpsDashboardRoute } from '~/composables/useDailyOpsDashboardRoute'
import {
  clientMetricsCacheKey,
  freshnessTierForRange,
  readClientMetricsCache,
  shouldSkipMetricsFetch,
  writeClientMetricsCache,
} from '~/composables/useDailyOpsClientMetricsCache'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'

type MaybeRefStr = Ref<string> | ComputedRef<string> | string
type MaybeRefAnchor =
  | Ref<string | null | undefined>
  | ComputedRef<string | null | undefined>
  | string
  | null
  | undefined

type StripResponse = VenueStripResponseDto & {
  cacheVersion?: string | null
  financeSealedMonths?: number | null
}

function unwrapStr (v: MaybeRefStr | undefined, fallback: string): string {
  if (v == null) return fallback
  return typeof v === 'string' ? v : String(v.value ?? fallback)
}

function unwrapAnchor (v: MaybeRefAnchor): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  const raw = v.value
  return raw == null || raw === '' ? null : String(raw)
}

export function useDailyOpsVenueStripMetrics (opts?: {
  period?: MaybeRefStr
  anchor?: MaybeRefAnchor
}) {
  const route = useDailyOpsDashboardRoute()

  const period = computed(() => unwrapStr(opts?.period, route.period.value))
  const anchor = computed(() => {
    if (opts && 'anchor' in (opts ?? {})) return unwrapAnchor(opts?.anchor)
    return route.anchor.value ?? null
  })

  const stripQuery = computed(() => {
    const q: Record<string, string> = { period: period.value }
    if (anchor.value) q.anchor = anchor.value
    return q
  })

  const asyncKey = computed(
    () => `daily-ops-venue-strip-shared-${period.value}-${anchor.value ?? ''}`,
  )

  const { data, pending, error, refresh } = useAsyncData(
    () => asyncKey.value,
    async () => {
      const q = stripQuery.value
      const range = resolveDailyOpsPeriod(q.period, q.anchor)
      const tier = freshnessTierForRange(q.period, range.endDate)
      const cacheKey = clientMetricsCacheKey('strip', q.period, q.anchor ?? null, null)
      const cached = readClientMetricsCache<StripResponse>(cacheKey)

      if (await shouldSkipMetricsFetch(cached, q)) {
        return cached!.data
      }

      const [fresh, ver] = await Promise.all([
        $fetch<StripResponse>('/api/daily-ops/metrics/venue-strip', { query: q }),
        tier === 'today'
          ? Promise.resolve({ version: null as string | null, financeSealedMonths: 0 })
          : $fetch<{ version: string | null; financeSealedMonths: number }>(
              '/api/daily-ops/metrics/period-cache-version',
              { query: q },
            ).catch(() => ({ version: null, financeSealedMonths: 0 })),
      ])
      writeClientMetricsCache(cacheKey, fresh, {
        version: fresh.cacheVersion ?? ver.version,
        financeSealedMonths: ver.financeSealedMonths,
        tier,
      })
      return fresh
    },
    { watch: [asyncKey] },
  )

  const venues = computed((): VenueStripCardDto[] => data.value?.venues ?? [])
  const ready = computed(() => !pending.value)

  return {
    data,
    venues,
    pending,
    ready,
    error,
    refresh,
    period,
    anchor,
  }
}
