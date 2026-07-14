/**
 * @registry-id: useWeeklyReportDocument
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Weekly report document fetch + section save (weekly_reports collection)
 * @last-fix: [2026-07-14] Initial weekly report document composable
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ pages/weekly-reports/*
 * ✓ components/weeklyReports/*
 */

import type { WeeklyReportDocument, WeeklyReportListItem, WeeklyReportSectionKey } from '~/types/weeklyReportDocument'
import { WEEKLY_REPORT_SECTION_KEYS } from '~/types/weeklyReportDocument'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'

export function useWeeklyReportDocument() {
  const route = useRoute()
  const router = useRouter()

  const weekKey = computed(() => {
    const w = route.params.weekKey
    if (typeof w === 'string' && /^\d{4}-W\d{2}$/.test(w)) return w
    return undefined
  })

  const locationId = computed(() => {
    const l = route.query.location
    if (typeof l === 'string' && l.length > 0) return l
    return DAILY_OPS_PROFIT_VENUE_LOCATIONS[0]?.locationId ?? ''
  })

  const fetchKey = computed(() => `weekly-report:${weekKey.value ?? 'list'}:${locationId.value}`)

  const listQuery = computed(() => {
    const q: Record<string, string> = {}
    if (locationId.value) q.locationId = locationId.value
    return new URLSearchParams(q).toString()
  })

  const { data: list, pending: listPending, refresh: refreshList } = useFetch<{ success: boolean; data: WeeklyReportListItem[] }>(
    () => `/api/weekly-reports?${listQuery.value}`,
    { key: 'weekly-reports-list', watch: [listQuery] },
  )

  const { data: document, pending, error, refresh } = useFetch<{ success: boolean; data: WeeklyReportDocument }>(
    () => weekKey.value
      ? `/api/weekly-reports/${weekKey.value}?locationId=${locationId.value}`
      : null,
    { key: fetchKey, watch: [weekKey, locationId] },
  )

  const doc = computed(() => document.value?.data ?? null)
  const isFrozen = computed(() => !!doc.value?.frozenAt)

  function setLocation(id: string) {
    router.replace({ path: route.path, query: { ...route.query, location: id } })
  }

  async function saveSection(sectionKey: WeeklyReportSectionKey, text: string) {
    if (!weekKey.value) return
    await $fetch(`/api/weekly-reports/${weekKey.value}/section/${sectionKey}`, {
      method: 'PUT',
      body: { text, locationId: locationId.value },
    })
    await refresh()
  }

  async function addCustomEvent(title: string, startDate: string, endDate: string, note?: string) {
    if (!weekKey.value) return
    await $fetch(`/api/weekly-reports/${weekKey.value}/events`, {
      method: 'POST',
      body: { title, startDate, endDate, note, locationId: locationId.value },
    })
    await refresh()
  }

  const venueOptions = DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => ({
    locationId: v.locationId,
    locationName: v.label,
  }))

  return {
    weekKey,
    locationId,
    doc,
    list: computed(() => list.value?.data ?? []),
    listPending,
    pending,
    error,
    refresh,
    refreshList,
    isFrozen,
    setLocation,
    saveSection,
    addCustomEvent,
    venueOptions,
    sectionKeys: WEEKLY_REPORT_SECTION_KEYS,
  }
}
