/**
 * @registry-id: useMonthlyReportDocument
 * @created: 2026-07-17T00:00:00.000Z
 * @last-modified: 2026-07-17T00:00:00.000Z
 * @description: Monthly report document fetch + section save (monthly_reports collection)
 * @last-fix: [2026-07-17] Initial monthly report document composable
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ pages/weekly-reports/month/*
 * ✓ components/weeklyReports/*
 */

import type { BlockAgree, BlockTodo } from '~/types/noteBlock'
import type { MonthlyReportDocument, MonthlyReportListItem, MonthlyReportSectionKey } from '~/types/monthlyReportDocument'
import { MONTHLY_REPORT_SECTION_KEYS } from '~/types/monthlyReportDocument'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'

export function useMonthlyReportDocument() {
  const route = useRoute()
  const router = useRouter()

  const monthKey = computed(() => {
    const m = route.params.monthKey
    if (typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return m
    return undefined
  })

  const locationId = computed(() => {
    const l = route.query.location
    if (typeof l === 'string' && l.length > 0) return l
    return DAILY_OPS_PROFIT_VENUE_LOCATIONS[0]?.locationId ?? ''
  })

  const fetchKey = computed(() => `monthly-report:${monthKey.value ?? 'list'}:${locationId.value}`)

  const listQuery = computed(() => {
    const q: Record<string, string> = {}
    if (locationId.value) q.locationId = locationId.value
    return new URLSearchParams(q).toString()
  })

  const { data: list, pending: listPending, refresh: refreshList } = useFetch<{ success: boolean; data: MonthlyReportListItem[] }>(
    () => `/api/monthly-reports?${listQuery.value}`,
    { key: 'monthly-reports-list', watch: [listQuery] },
  )

  const { data: document, pending, error, refresh } = useFetch<{ success: boolean; data: MonthlyReportDocument }>(
    () => monthKey.value
      ? `/api/monthly-reports/${monthKey.value}?locationId=${locationId.value}`
      : null,
    { key: fetchKey, watch: [monthKey, locationId] },
  )

  const doc = computed(() => document.value?.data ?? null)
  const isLocked = computed(() => !!doc.value?.frozenAt)
  const lockPending = ref(false)

  function setLocation(id: string) {
    router.replace({ path: route.path, query: { ...route.query, location: id } })
  }

  async function setLocked(locked: boolean) {
    if (!monthKey.value) return
    lockPending.value = true
    try {
      await $fetch(`/api/monthly-reports/${monthKey.value}/lock`, {
        method: 'PUT',
        body: { locationId: locationId.value, locked },
      })
      await refresh()
    } finally {
      lockPending.value = false
    }
  }

  async function unlock() {
    await setLocked(false)
  }

  async function saveAndLock() {
    await setLocked(true)
  }

  async function saveSection(
    sectionKey: MonthlyReportSectionKey,
    text: string,
    todos?: BlockTodo[],
    agrees?: BlockAgree[],
  ) {
    if (!monthKey.value) return
    await $fetch(`/api/monthly-reports/${monthKey.value}/section/${sectionKey}`, {
      method: 'PUT',
      body: { text, todos, agrees, locationId: locationId.value },
    })
    await refresh()
  }

  async function addCustomEvent(title: string, startDate: string, endDate: string, note?: string) {
    if (!monthKey.value) return
    await $fetch(`/api/monthly-reports/${monthKey.value}/events`, {
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
    monthKey,
    locationId,
    doc,
    list: computed(() => list.value?.data ?? []),
    listPending,
    pending,
    error,
    refresh,
    refreshList,
    isLocked,
    lockPending,
    unlock,
    saveAndLock,
    setLocation,
    saveSection,
    addCustomEvent,
    venueOptions,
    sectionKeys: MONTHLY_REPORT_SECTION_KEYS,
  }
}
