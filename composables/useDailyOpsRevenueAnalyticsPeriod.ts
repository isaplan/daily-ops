import {
  REVENUE_ANALYTICS_DEFAULT_PERIOD,
  REVENUE_ANALYTICS_PERIOD_IDS,
  type DailyOpsRevenuePeriodId,
} from '~/types/daily-ops-revenue'
import {
  isRevenueAnalyticsPeriod,
  isSpaceValidForLocation,
  periodGroupForPeriod,
} from '~/utils/dailyOpsRevenueAnalyticsNav'
import { resolveDailyOpsRevenuePeriod } from '~/utils/dailyOpsRevenuePeriod'
import { useDailyOpsRevenuePeriod } from '~/composables/useDailyOpsRevenuePeriod'

const ANALYTICS_SET = new Set<string>(REVENUE_ANALYTICS_PERIOD_IDS)

export function useDailyOpsRevenueAnalyticsPeriod() {
  const route = useRoute()
  const router = useRouter()
  const base = useDailyOpsRevenuePeriod()

  const period = computed((): DailyOpsRevenuePeriodId => {
    const p = route.query.period
    if (typeof p === 'string' && ANALYTICS_SET.has(p)) return p as DailyOpsRevenuePeriodId
    return REVENUE_ANALYTICS_DEFAULT_PERIOD
  })

  const activePeriodGroup = computed(() => periodGroupForPeriod(period.value))

  const compareEnabled = computed(() => {
    const c = route.query.compareTo
    if (c === 'ab') return true
    return typeof route.query.comparePeriod === 'string' && route.query.comparePeriod.length > 0
  })

  const comparePeriod = computed((): DailyOpsRevenuePeriodId | null => {
    const p = route.query.comparePeriod
    if (typeof p === 'string' && ANALYTICS_SET.has(p)) return p as DailyOpsRevenuePeriodId
    return null
  })

  const compareLocationId = computed(() => {
    const l = route.query.compareLocation
    return typeof l === 'string' && l.length > 0 && l !== 'all' ? l : null
  })

  function mergeQuery(patch: Record<string, string | undefined>) {
    const q = { ...route.query } as Record<string, string | string[] | undefined>
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') delete q[k]
      else q[k] = v
    }
    return q
  }

  function setPeriod(next: DailyOpsRevenuePeriodId) {
    if (!isRevenueAnalyticsPeriod(next)) return
    router.replace({ path: route.path, query: mergeQuery({ period: next }) })
  }

  function setLocation(id: string | null) {
    const q = mergeQuery({ location: id ?? undefined })
    const space = route.query.space
    if (typeof space === 'string' && !isSpaceValidForLocation(id, space)) {
      delete q.space
    }
    router.replace({ path: route.path, query: q })
  }

  function setLocationSpace(space: string | null) {
    base.setLocationSpace(space)
  }

  function setCompareAb(opts: {
    enabled: boolean
    comparePeriod?: DailyOpsRevenuePeriodId | null
    compareLocation?: string | null
  }) {
    if (!opts.enabled) {
      router.replace({
        path: route.path,
        query: mergeQuery({
          compareTo: 'none',
          comparePeriod: undefined,
          compareLocation: undefined,
          compareStartDate: undefined,
          compareEndDate: undefined,
        }),
      })
      return
    }
    const cp = opts.comparePeriod ?? 'last-week'
    router.replace({
      path: route.path,
      query: mergeQuery({
        compareTo: 'ab',
        comparePeriod: cp,
        compareLocation: opts.compareLocation ?? undefined,
      }),
    })
  }

  if (import.meta.client) {
    watch(
      () => route.query.period,
      (p) => {
        if (typeof p !== 'string' || !ANALYTICS_SET.has(p)) {
          router.replace({
            path: route.path,
            query: mergeQuery({ period: REVENUE_ANALYTICS_DEFAULT_PERIOD }),
          })
        }
      },
      { immediate: true },
    )
  }

  const primaryRange = computed(() =>
    resolveDailyOpsRevenuePeriod(period.value, base.anchor.value ?? undefined, new Date(), {
      startDate: base.startDate.value ?? undefined,
      endDate: base.endDate.value ?? undefined,
    }),
  )

  const compareRange = computed(() => {
    if (!compareEnabled.value || !comparePeriod.value) return null
    return resolveDailyOpsRevenuePeriod(
      comparePeriod.value,
      base.anchor.value ?? undefined,
      new Date(),
    )
  })

  const revenueQuery = computed(() => {
    const q: Record<string, string> = {
      period: period.value,
      compareTo: compareEnabled.value ? 'ab' : 'none',
      anchor: base.openRegisterYmd.value,
    }
    if (base.locationId.value) q.location = base.locationId.value
    if (base.locationSpace.value) q.space = base.locationSpace.value
    if (period.value === 'custom' && base.startDate.value && base.endDate.value) {
      q.startDate = base.startDate.value
      q.endDate = base.endDate.value
    }
    if (compareEnabled.value && comparePeriod.value) {
      q.comparePeriod = comparePeriod.value
      if (compareLocationId.value) q.compareLocation = compareLocationId.value
      if (compareRange.value) {
        q.compareStartDate = compareRange.value.startDate
        q.compareEndDate = compareRange.value.endDate
      }
    }
    return q
  })

  return {
    ...base,
    period,
    activePeriodGroup,
    compareEnabled,
    comparePeriod,
    compareLocationId,
    primaryRange,
    compareRange,
    revenueQuery,
    setPeriod,
    setLocation,
    setLocationSpace,
    setCompareAb,
  }
}
