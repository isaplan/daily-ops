/**
 * @registry-id: useDailyOpsRevenueAverages
 * @created: 2026-07-25T11:25:00.000Z
 * @last-modified: 2026-07-25T11:25:00.000Z
 * @description: Lazy-fetch revenue averages + YoY (non-blocking dash while pending)
 * @last-fix: [2026-07-25] Lazy client:true; format helpers for tile/drawer
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsKpiTiles.vue
 * ✓ components/daily-ops/DailyOpsVenueStrip.vue
 */

import type {
  DailyOpsRevenueAveragesDto,
  RevenueAverageCompareSlice,
  RevenueAverageVenueDto,
} from '~/types/revenue-averages'

export function useDailyOpsRevenueAverages (opts: {
  period: Ref<string> | ComputedRef<string>
  anchor?: Ref<string | null | undefined> | ComputedRef<string | null | undefined>
  revenue: Ref<number> | ComputedRef<number>
  venueRevenueByLocationId?: Ref<Record<string, number> | undefined> | ComputedRef<Record<string, number> | undefined>
  enabled?: Ref<boolean> | ComputedRef<boolean>
}) {
  const { formatEurWhole } = useDashboardKpiFormat()

  const query = computed(() => {
    const q: Record<string, string> = {
      period: opts.period.value,
      revenue: String(opts.revenue.value ?? 0),
    }
    const anchor = opts.anchor?.value
    if (anchor) q.anchor = anchor
    const map = opts.venueRevenueByLocationId?.value
    if (map && Object.keys(map).length) q.venueRevenue = JSON.stringify(map)
    return q
  })

  const key = computed(
    () =>
      `daily-ops-rev-avg-${query.value.period}-${query.value.anchor ?? ''}-${query.value.revenue}-${query.value.venueRevenue ?? ''}`,
  )

  const enabled = computed(() => opts.enabled?.value !== false)

  const { data, pending, error, refresh } = useAsyncData(
    key,
    async (): Promise<DailyOpsRevenueAveragesDto | null> => {
      if (!enabled.value) return null
      const params = new URLSearchParams(query.value).toString()
      return await $fetch<DailyOpsRevenueAveragesDto>(
        `/api/daily-ops/metrics/revenue-averages?${params}`,
      )
    },
    {
      watch: [key, enabled],
      lazy: true,
      server: false,
      immediate: true,
    },
  )

  function formatPctVs (pct: number | null | undefined): string | null {
    if (pct == null || !Number.isFinite(pct)) return null
    const sign = pct > 0 ? '+' : ''
    return `${sign}${pct.toFixed(1)}%`
  }

  function formatCompareLine (slice: RevenueAverageCompareSlice | null | undefined): string {
    if (pending.value && !data.value) return '—'
    if (!slice || slice.revenue <= 0) return '—'
    const pct = formatPctVs(slice.pctVsCurrent)
    return pct
      ? `${slice.label} ${formatEurWhole(slice.revenue)} · ${pct}`
      : `${slice.label} ${formatEurWhole(slice.revenue)}`
  }

  function forLocation (locationId: string): RevenueAverageVenueDto | null {
    return data.value?.byVenue.find((v) => v.locationId === locationId) ?? null
  }

  const combined = computed(() => data.value?.combined ?? null)

  return {
    data,
    pending,
    error,
    refresh,
    combined,
    forLocation,
    formatPctVs,
    formatCompareLine,
  }
}
