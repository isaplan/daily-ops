import {
  DAILY_OPS_REVENUE_PERIOD_IDS,
  type DailyOpsRevenueCompareKind,
  type DailyOpsRevenuePeriodId,
} from '~/types/daily-ops-revenue'
import {
  resolveDailyOpsRevenuePeriod,
  resolveRevenueCompareRange,
} from '~/utils/dailyOpsRevenuePeriod'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

const PERIOD_SET = new Set<string>(DAILY_OPS_REVENUE_PERIOD_IDS)
const COMPARE_SET = new Set<string>(['none', 'previous', 'ly', 'custom'])

export function useDailyOpsRevenuePeriod() {
  const route = useRoute()
  const router = useRouter()

  const period = computed((): DailyOpsRevenuePeriodId => {
    const p = route.query.period
    return typeof p === 'string' && PERIOD_SET.has(p) ? (p as DailyOpsRevenuePeriodId) : 'today'
  })

  const compareTo = computed((): DailyOpsRevenueCompareKind => {
    const c = route.query.compareTo
    return typeof c === 'string' && COMPARE_SET.has(c) ? (c as DailyOpsRevenueCompareKind) : 'none'
  })

  const locationId = computed(() => {
    const l = route.query.location
    return typeof l === 'string' && l.length > 0 && l !== 'all' ? l : null
  })

  const anchor = computed(() => {
    const a = route.query.anchor
    return typeof a === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a) ? a : null
  })

  const startDate = computed(() => {
    const s = route.query.startDate
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
  })

  const endDate = computed(() => {
    const e = route.query.endDate
    return typeof e === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e) ? e : null
  })

  const locationSpace = computed(() => {
    const s = route.query.space
    return typeof s === 'string' && s.length > 0 && s !== 'all' ? s : null
  })

  const compareStartDate = computed(() => {
    const s = route.query.compareStartDate
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
  })

  const compareEndDate = computed(() => {
    const e = route.query.compareEndDate
    return typeof e === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e) ? e : null
  })

  const openRegisterYmd = computed(() => amsterdamOpenRegisterBusinessDateYmd())

  const primaryRange = computed(() =>
    resolveDailyOpsRevenuePeriod(period.value, anchor.value ?? undefined, new Date(), {
      startDate: startDate.value ?? undefined,
      endDate: endDate.value ?? undefined,
    }),
  )

  const compareRange = computed(() =>
    resolveRevenueCompareRange(compareTo.value, primaryRange.value, new Date(), {
      startDate: compareStartDate.value ?? undefined,
      endDate: compareEndDate.value ?? undefined,
    }),
  )

  const revenueQuery = computed(() => {
    const q: Record<string, string> = {
      period: period.value,
      compareTo: compareTo.value,
      anchor: openRegisterYmd.value,
    }
    if (locationId.value) q.location = locationId.value
    if (locationSpace.value) q.space = locationSpace.value
    if (period.value === 'custom' && startDate.value && endDate.value) {
      q.startDate = startDate.value
      q.endDate = endDate.value
    }
    if (compareRange.value) {
      q.compareStartDate = compareRange.value.startDate
      q.compareEndDate = compareRange.value.endDate
    }
    return q
  })

  if (import.meta.client) {
    watch(
      openRegisterYmd,
      (open) => {
        if (anchor.value === open) return
        router.replace({ path: route.path, query: { ...route.query, anchor: open } })
      },
      { immediate: true },
    )
  }

  function setPeriod(next: DailyOpsRevenuePeriodId) {
    router.replace({ path: route.path, query: { ...route.query, period: next } })
  }

  function setCompareTo(next: DailyOpsRevenueCompareKind) {
    router.replace({ path: route.path, query: { ...route.query, compareTo: next } })
  }

  function setLocation(id: string | null) {
    const q = { ...route.query } as Record<string, string | string[] | null | undefined>
    if (id) q.location = id
    else delete q.location
    router.replace({ path: route.path, query: q })
  }

  function setCustomRange(start: string, end: string) {
    router.replace({
      path: route.path,
      query: { ...route.query, period: 'custom', startDate: start, endDate: end },
    })
  }

  function setLocationSpace(space: string | null) {
    const q = { ...route.query } as Record<string, string | string[] | null | undefined>
    if (space) q.space = space
    else delete q.space
    router.replace({ path: route.path, query: q })
  }

  function setCustomCompareRange(start: string, end: string) {
    router.replace({
      path: route.path,
      query: {
        ...route.query,
        compareTo: 'custom',
        compareStartDate: start,
        compareEndDate: end,
      },
    })
  }

  return {
    period,
    compareTo,
    locationId,
    locationSpace,
    anchor,
    startDate,
    endDate,
    compareStartDate,
    compareEndDate,
    openRegisterYmd,
    primaryRange,
    compareRange,
    revenueQuery,
    setPeriod,
    setCompareTo,
    setLocation,
    setLocationSpace,
    setCustomRange,
    setCustomCompareRange,
  }
}
