/**
 * @registry-id: useDailyOpsLocationChartColors
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Client SSOT for venue graph colors from GET /api/daily-ops/locations (unified_location.chartColor).
 * @last-fix: [2026-05-28] Graph components reference DB-backed location colors.
 *
 * @exports-to:
 * ✓ components/daily-ops/DailyOpsTodayHourlyDualAxisChart.vue
 */

import type { DailyOpsLocationsResponseDto } from '~/types/daily-ops-locations'

export function useDailyOpsLocationChartColors() {
  const { data, pending, error, refresh } = useFetch<DailyOpsLocationsResponseDto>(
    '/api/daily-ops/locations',
    { key: 'daily-ops-locations' },
  )

  const locations = computed(() => data.value?.data ?? [])

  const colorByLocationId = computed(() => {
    const map = new Map<string, string>()
    for (const row of locations.value) {
      map.set(row._id, row.chartColor)
    }
    return map
  })

  function chartColorFor(locationId: string): string {
    return colorByLocationId.value.get(locationId) ?? '#111827'
  }

  return {
    locations,
    colorByLocationId,
    chartColorFor,
    pending,
    error,
    refresh,
  }
}
