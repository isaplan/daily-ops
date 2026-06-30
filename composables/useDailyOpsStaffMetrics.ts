/**
 * @registry-id: useDailyOpsStaffMetrics
 * @created: 2026-06-25T12:00:00.000Z
 * @last-modified: 2026-06-27T18:00:00.000Z
 * @description: Staff totals analytics — timeseries (all venues, chart filters client-side)
 * @last-fix: [2026-06-28] Fix loadedKey when timeseries arrives; reset on mode switch
 * @adr-ref: ADR-004, ADR-011
 *
 * @exports-to:
 * ✓ components/daily-ops/staff/StaffTotalsTab.vue
 * ✓ pages/daily-ops/staff/totals.vue
 */

import type { DailyOpsStaffTimeseriesDto } from '~/types/daily-ops-staff'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import {
  chartGranularityLabel as staffChartGranularityLabel,
  coerceStaffNavMode,
  staffAnalyticsRange,
} from '~/utils/dailyOpsStaffNav/modes'

function buildQueryString(q: Record<string, string>): string {
  return new URLSearchParams(q).toString()
}

export function useDailyOpsStaffMetrics() {
  const route = useRoute()

  const staffMode = computed(() =>
    coerceStaffNavMode(typeof route.query.mode === 'string' ? route.query.mode : ''),
  )
  const anchor = computed(() => amsterdamOpenRegisterBusinessDateYmd())

  const analyticsRange = computed(() =>
    staffAnalyticsRange(staffMode.value, anchor.value),
  )

  const staffQuery = computed(() => ({
    mode: staffMode.value,
    anchor: anchor.value,
  }))

  const primaryRange = computed(() => ({
    startDate: analyticsRange.value.startDate,
    endDate: analyticsRange.value.endDate,
    label: analyticsRange.value.label,
  }))

  const chartGranularity = computed(() => analyticsRange.value.chartGranularity)
  const chartGranularityLabel = computed(() => staffChartGranularityLabel(staffMode.value))

  const qs = computed(() => buildQueryString(staffQuery.value))
  const cacheKey = computed(() => `staff-${qs.value}-${chartGranularity.value}`)

  const loadedKey = ref<string | null>(null)

  const { data: timeseriesRaw, pending } = useAsyncData(
    () => `staff-ts-${cacheKey.value}`,
    () =>
      $fetch<DailyOpsStaffTimeseriesDto>('/api/daily-ops/staff/timeseries', {
        query: staffQuery.value,
      }),
    { watch: [qs] },
  )

  watch([pending, cacheKey, timeseriesRaw], () => {
    if (!pending.value && timeseriesRaw.value) {
      loadedKey.value = cacheKey.value
    }
  })

  watch(cacheKey, () => {
    loadedKey.value = null
  })

  const isReady = computed(() => !pending.value && loadedKey.value === cacheKey.value)
  const isLoading = computed(() => !isReady.value)

  const timeseries = computed(() =>
    isReady.value ? (timeseriesRaw.value ?? null) : null,
  )

  return {
    staffQuery,
    primaryRange,
    staffMode,
    chartGranularity,
    chartGranularityLabel,
    timeseries,
    isLoading,
  }
}
