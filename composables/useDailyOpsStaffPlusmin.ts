/**
 * @registry-id: useDailyOpsStaffPlusmin
 * @created: 2026-06-25T14:00:00.000Z
 * @last-modified: 2026-06-25T14:00:00.000Z
 * @description: Staff plus/min tab — summary fetch via Nav V2 query
 * @last-fix: [2026-06-25] Plus/min KPI + venue breakdown
 *
 * @exports-to:
 * ✓ components/daily-ops/staff/StaffPlusminTab.vue
 */

import type { DailyOpsStaffPlusminSummaryDto } from '~/types/daily-ops-staff'
import {
  buildRevenueQueryFromNavV2,
  resolveNavV2RevenueApiQuery,
} from '~/utils/dailyOpsRevenueNavV2/toRevenueApiQuery'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

function buildQueryString(q: Record<string, string>): string {
  return new URLSearchParams(q).toString()
}

export function useDailyOpsStaffPlusmin() {
  const navV2 = useDailyOpsRevenueNavV2()

  const staffQuery = computed(() => {
    const { slot, pick, granularity, location, mode } = navV2.query.value
    const api = resolveNavV2RevenueApiQuery({ slot, pick, granularity })
    const base = api
      ? buildRevenueQueryFromNavV2(api, {
          anchor: amsterdamOpenRegisterBusinessDateYmd(),
          locationId: location,
        })
      : {
          period: 'this-month',
          compareTo: 'none',
          anchor: amsterdamOpenRegisterBusinessDateYmd(),
        }
    return { ...base, mode, slot }
  })

  const qs = computed(() => buildQueryString(staffQuery.value))

  const { data, pending, error, refresh } = useAsyncData(
    () => `staff-plusmin-${qs.value}`,
    () =>
      $fetch<DailyOpsStaffPlusminSummaryDto>('/api/daily-ops/staff/plusmin-summary', {
        query: staffQuery.value,
      }),
    { watch: [qs] },
  )

  return {
    summary: computed(() => data.value ?? null),
    pending,
    error,
    refresh,
    staffQuery,
  }
}
