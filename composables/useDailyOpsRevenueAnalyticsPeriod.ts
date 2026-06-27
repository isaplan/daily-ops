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
import {
  buildRevenueQueryFromNavV2,
  navV2RangeToRevenueRange,
  resolveNavV2RevenueApiQuery,
} from '~/utils/dailyOpsRevenueNavV2/toRevenueApiQuery'
import { useDailyOpsRevenuePeriod } from '~/composables/useDailyOpsRevenuePeriod'

const ANALYTICS_SET = new Set<string>(REVENUE_ANALYTICS_PERIOD_IDS)

function timeseriesGranularity(startDate: string, endDate: string): 'day' | 'week' | 'month' {
  const days = Math.ceil((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1
  if (days <= 45) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

export function useDailyOpsRevenueAnalyticsPeriod() {
  const route = useRoute()
  const router = useRouter()
  const base = useDailyOpsRevenuePeriod()
  const navV2Enabled = useRuntimeConfig().public.revenueNavVersion === 'v2'
  const navV2 = navV2Enabled ? useDailyOpsRevenueNavV2() : null

  const navV2ApiQuery = computed(() => {
    if (!navV2) return null
    const { slot, pick, granularity } = navV2.query.value
    return resolveNavV2RevenueApiQuery({ slot, pick, granularity })
  })

  const period = computed((): DailyOpsRevenuePeriodId => {
    if (navV2ApiQuery.value) return navV2ApiQuery.value.period
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

  if (import.meta.client && !navV2Enabled) {
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

  const primaryRange = computed(() => {
    if (navV2ApiQuery.value) return navV2RangeToRevenueRange(navV2ApiQuery.value)
    return resolveDailyOpsRevenuePeriod(period.value, base.anchor.value ?? undefined, new Date(), {
      startDate: base.startDate.value ?? undefined,
      endDate: base.endDate.value ?? undefined,
    })
  })

  const compareRange = computed(() => {
    if (!compareEnabled.value || !comparePeriod.value) return null
    return resolveDailyOpsRevenuePeriod(
      comparePeriod.value,
      base.anchor.value ?? undefined,
      new Date(),
    )
  })

  const chartGranularity = computed((): 'day' | 'week' | 'month' => {
    if (navV2ApiQuery.value) return navV2ApiQuery.value.granularity
    return timeseriesGranularity(primaryRange.value.startDate, primaryRange.value.endDate)
  })

  const revenueQuery = computed(() => {
    if (navV2Enabled) {
      if (navV2ApiQuery.value) {
        return buildRevenueQueryFromNavV2(navV2ApiQuery.value, {
          anchor: base.openRegisterYmd.value,
          locationId: navV2?.query.value.location ?? base.locationId.value,
          locationSpace: navV2?.query.value.space ?? base.locationSpace.value,
          compareTo: compareEnabled.value ? 'ab' : 'none',
          comparePeriod: comparePeriod.value ?? undefined,
          compareLocation: compareLocationId.value,
          compareStartDate: compareRange.value?.startDate,
          compareEndDate: compareRange.value?.endDate,
        })
      }
      return {
        period: 'today',
        compareTo: 'none',
        anchor: base.openRegisterYmd.value,
        ...(navV2?.query.value.location ? { location: navV2.query.value.location } : {}),
      }
    }
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
    chartGranularity,
    revenueQuery,
    setPeriod,
    setLocation,
    setLocationSpace,
    setCompareAb,
  }
}
