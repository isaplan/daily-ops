/**
 * @registry-id: useDailyOpsBreakEven
 * @created: 2026-07-24T11:40:00.000Z
 * @last-modified: 2026-07-24T15:10:00.000Z
 * @description: Fetch break-even for dashboard period + format helpers
 * @last-fix: [2026-07-24] Optional includeVenues + venueRevenue map
 * @adr-ref: ADR-014
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 * ✓ components/daily-ops/DailyOpsVenueStrip.vue
 * ✓ components/daily-ops/revenue/RevenuePnLCard.vue
 */

import type { DailyOpsBreakEvenBundleDto, DailyOpsBreakEvenDto } from '~/types/break-even'

export function useDailyOpsBreakEven (opts: {
  period: Ref<string> | ComputedRef<string>
  anchor?: Ref<string | null | undefined> | ComputedRef<string | null | undefined>
  revenue: Ref<number> | ComputedRef<number>
  locationId?: Ref<string | null | undefined> | ComputedRef<string | null | undefined>
  dayCount?: Ref<number | null | undefined> | ComputedRef<number | null | undefined>
  includeVenues?: Ref<boolean> | ComputedRef<boolean>
  /** locationId → revenue for byVenue % calc */
  venueRevenueByLocationId?: Ref<Record<string, number> | undefined> | ComputedRef<Record<string, number> | undefined>
  enabled?: Ref<boolean> | ComputedRef<boolean>
}) {
  const query = computed(() => {
    const q: Record<string, string> = {
      period: opts.period.value,
      revenue: String(opts.revenue.value ?? 0),
    }
    const anchor = opts.anchor?.value
    if (anchor) q.anchor = anchor
    const loc = opts.locationId?.value
    if (loc) q.locationId = loc
    const days = opts.dayCount?.value
    if (days != null && days > 0) q.dayCount = String(Math.round(days))
    if (opts.includeVenues?.value) {
      q.includeVenues = '1'
      const map = opts.venueRevenueByLocationId?.value
      if (map && Object.keys(map).length) q.venueRevenue = JSON.stringify(map)
    }
    return q
  })

  const key = computed(
    () =>
      `daily-ops-break-even-${query.value.period}-${query.value.anchor ?? ''}-${query.value.locationId ?? 'all'}-${query.value.revenue}-${query.value.dayCount ?? ''}-${query.value.includeVenues ?? ''}-${query.value.venueRevenue ?? ''}`,
  )

  const enabled = computed(() => opts.enabled?.value !== false)

  const { data, pending, error, refresh } = useAsyncData(
    key,
    async (): Promise<DailyOpsBreakEvenDto | DailyOpsBreakEvenBundleDto | null> => {
      if (!enabled.value) return null
      const params = new URLSearchParams(query.value).toString()
      return await $fetch<DailyOpsBreakEvenDto | DailyOpsBreakEvenBundleDto>(
        `/api/daily-ops/metrics/break-even?${params}`,
      )
    },
    { watch: [key, enabled], lazy: true, server: false, immediate: true },
  )

  const byVenue = computed((): DailyOpsBreakEvenDto[] => {
    const d = data.value
    if (!d || !('byVenue' in d) || !Array.isArray(d.byVenue)) return []
    return d.byVenue
  })

  function formatPctVs (pct: number | null | undefined): string | null {
    if (pct == null || !Number.isFinite(pct)) return null
    const sign = pct > 0 ? '+' : ''
    return `${sign}${pct.toFixed(1)}%`
  }

  function breakEvenForLocation (locationId: string): DailyOpsBreakEvenDto | null {
    return byVenue.value.find((v) => v.locationId === locationId) ?? null
  }

  return { data, byVenue, pending, error, refresh, formatPctVs, breakEvenForLocation }
}
