/**
 * @registry-id: useDailyOpsStaffLeaveCalendar
 * @created: 2026-08-13T14:13:52.000Z
 * @last-modified: 2026-08-13T14:37:54.000Z
 * @description: Staff leave year Gantt — fetch + year nav
 * @last-fix: [2026-08-13] Year query param for Gantt view
 * @adr-ref: ADR-004
 * @data-source: direct-db
 * @read-cache-json: none
 * @imports-data-from: GET /api/daily-ops/staff/leave-calendar
 *
 * @exports-to:
 * ✓ components/daily-ops/staff/StaffLeaveCalendarTab.vue
 * ✓ pages/daily-ops/staff/leave.vue
 */

import type { DailyOpsStaffLeaveCalendarDto } from '~/types/daily-ops-staff'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

export function useDailyOpsStaffLeaveCalendar () {
  const route = useRoute()
  const router = useRouter()
  const { locationId, anchor } = useDailyOpsDashboardRoute()

  const year = computed(() => {
    const q = route.query.year
    if (typeof q === 'string' && /^\d{4}$/.test(q)) return Number(q)
    const a = typeof route.query.anchor === 'string' ? route.query.anchor : anchor.value
    const y = Number((a || amsterdamOpenRegisterBusinessDateYmd()).slice(0, 4))
    return Number.isFinite(y) ? y : new Date().getFullYear()
  })

  const apiQuery = computed(() => {
    const q: Record<string, string> = { year: String(year.value) }
    if (locationId.value) q.locationId = locationId.value
    return q
  })

  const qs = computed(() => new URLSearchParams(apiQuery.value).toString())

  const { data, pending, error, refresh } = useAsyncData(
    () => `staff-leave-calendar-${qs.value}`,
    () =>
      $fetch<DailyOpsStaffLeaveCalendarDto>('/api/daily-ops/staff/leave-calendar', {
        query: apiQuery.value,
      }),
    { watch: [qs] },
  )

  function setYear (next: number) {
    const q = { ...route.query } as Record<string, string | string[] | null | undefined>
    q.year = String(next)
    delete q.month
    router.replace({ path: route.path, query: q })
  }

  function prevYear () {
    setYear(year.value - 1)
  }

  function nextYear () {
    setYear(year.value + 1)
  }

  return {
    calendar: computed(() => data.value ?? null),
    year,
    pending,
    error,
    refresh,
    prevYear,
    nextYear,
    setYear,
  }
}
