/**
 * @registry-id: useDailyOpsVenueStripMetrics
 * @created: 2026-08-16T14:20:00.000Z
 * @last-modified: 2026-08-16T14:20:00.000Z
 * @description: Shared venue-strip GET — one HTTP for KPI tiles + VenueStrip
 * @last-fix: [2026-08-16] Deduped strip fetch (was double-called by KPI + strip)
 * @adr-ref: ADR-004, ADR-013
 * @data-source: read-cache | snapshot-today-live
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

type MaybeRefStr = Ref<string> | ComputedRef<string> | string
type MaybeRefAnchor =
  | Ref<string | null | undefined>
  | ComputedRef<string | null | undefined>
  | string
  | null
  | undefined

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
    () =>
      $fetch<VenueStripResponseDto>('/api/daily-ops/metrics/venue-strip', {
        query: stripQuery.value,
      }),
    { watch: [asyncKey] },
  )

  const venues = computed((): VenueStripCardDto[] => data.value?.venues ?? [])
  /** True once the strip request settled (success or empty) — unlocks deferred bundle. */
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
