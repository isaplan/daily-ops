/**
 * @registry-id: useDailyOpsWeeklyReport
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-07-14T22:00:00.000Z
 * @description: Weekly report state + fetch via read-cache API
 * @last-fix: [2026-07-14] shiftWeek works before digest loads; shared getIsoWeekFromYmd
 * @adr-ref: ADR-004, ADR-013
 * @data-source: read-cache
 * @read-cache-json: weekly-digest (via GET /api/daily-ops/analytics/weekly-digest)
 *
 * @exports-to:
 * ✓ pages/daily-ops/analytics/weekly-report.vue
 * ✓ components/daily-ops/analytics/*
 */

import type { WeeklyDigestDto, WeeklyPerformanceStatus, WeeklyTargetPresetId } from '~/types/daily-ops-weekly-report'
import { WEEKLY_TARGET_PRESETS } from '~/types/daily-ops-weekly-report'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import { getIsoWeekFromYmd, isoWeekMondayYmd } from '~/utils/dailyOpsPeriodBreakdownChart'

export type WeeklyReportTabId = 'overview' | 'revenue' | 'labor' | 'staff' | 'loss'

const TAB_IDS: WeeklyReportTabId[] = ['overview', 'revenue', 'labor', 'staff', 'loss']

export function useDailyOpsWeeklyReport() {
  const route = useRoute()
  const router = useRouter()

  const week = computed(() => {
    const w = route.query.week
    return typeof w === 'string' && /^\d{4}-W\d{2}$/.test(w) ? w : undefined
  })

  const period = computed(() => {
    const p = route.query.period
    if (p === 'this-week') return 'this-week'
    return 'last-week'
  })

  const locationId = computed(() => {
    const l = route.query.location
    return typeof l === 'string' && l.length > 0 ? l : 'all'
  })

  const targetsPreset = computed((): WeeklyTargetPresetId => {
    const t = route.query.targets
    if (typeof t === 'string' && t in WEEKLY_TARGET_PRESETS) return t as WeeklyTargetPresetId
    return 'standard'
  })

  const activeTab = computed((): WeeklyReportTabId => {
    const t = route.query.tab
    return typeof t === 'string' && TAB_IDS.includes(t as WeeklyReportTabId)
      ? (t as WeeklyReportTabId)
      : 'overview'
  })

  const queryString = computed(() => {
    const q: Record<string, string> = { period: period.value, targets: targetsPreset.value }
    if (week.value) q.week = week.value
    if (locationId.value !== 'all') q.location = locationId.value
    const a = route.query.anchor
    if (typeof a === 'string') q.anchor = a
    return new URLSearchParams(q).toString()
  })

  const fetchKey = computed(() => `weekly-digest:${queryString.value}`)

  const { data: digest, pending, error, refresh } = useFetch<WeeklyDigestDto>(
    () => `/api/daily-ops/analytics/weekly-digest?${queryString.value}`,
    {
      key: fetchKey,
      watch: [queryString],
    },
  )

  function setTab(tab: WeeklyReportTabId) {
    router.replace({ path: route.path, query: { ...route.query, tab } })
  }

  function setLocation(id: string | null) {
    const q = { ...route.query } as Record<string, string | string[] | null | undefined>
    if (id && id !== 'all') q.location = id
    else delete q.location
    router.replace({ path: route.path, query: q })
  }

  function setTargetsPreset(preset: WeeklyTargetPresetId) {
    router.replace({ path: route.path, query: { ...route.query, targets: preset } })
  }

  function setWeek(weekKey: string) {
    const q = { ...route.query } as Record<string, string | string[] | null | undefined>
    q.week = weekKey
    delete q.period
    router.replace({ path: route.path, query: q })
  }

  function goToThisWeek() {
    const q = { ...route.query } as Record<string, string | string[] | null | undefined>
    delete q.week
    q.period = 'this-week'
    router.replace({ path: route.path, query: q })
  }

  function goToLastWeek() {
    const q = { ...route.query } as Record<string, string | string[] | null | undefined>
    delete q.week
    q.period = 'last-week'
    router.replace({ path: route.path, query: q })
  }

  const isThisWeek = computed(() => period.value === 'this-week' && !week.value)
  const isLastWeek = computed(() => period.value === 'last-week' && !week.value)

  function shiftWeek(deltaWeeks: number) {
    let baseStart: string | undefined
    if (digest.value) {
      baseStart = digest.value.startDate
    } else if (week.value) {
      baseStart = isoWeekMondayYmd(week.value) ?? undefined
    } else {
      baseStart = resolveDailyOpsPeriod(period.value).startDate
    }
    if (!baseStart) return
    const start = addCalendarDaysYmd(baseStart, deltaWeeks * 7)
    setWeek(getIsoWeekFromYmd(start))
  }

  function statusBadgeClass(status: WeeklyPerformanceStatus): string {
    if (status === 'good') return 'bg-green-100 text-green-800'
    if (status === 'bad') return 'bg-red-100 text-red-800'
    return 'bg-amber-100 text-amber-800'
  }

  function statusLabel(status: WeeklyPerformanceStatus): string {
    if (status === 'good') return 'On target'
    if (status === 'bad') return 'At risk'
    return 'Needs attention'
  }

  return {
    digest,
    pending,
    error,
    refresh,
    week,
    period,
    locationId,
    targetsPreset,
    activeTab,
    setTab,
    setLocation,
    setTargetsPreset,
    setWeek,
    shiftWeek,
    goToThisWeek,
    goToLastWeek,
    isThisWeek,
    isLastWeek,
    statusBadgeClass,
    statusLabel,
    targetPresets: WEEKLY_TARGET_PRESETS,
  }
}

