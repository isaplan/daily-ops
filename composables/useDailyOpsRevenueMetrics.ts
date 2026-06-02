import type {
  DailyOpsRevenueCategoryDto,
  DailyOpsRevenueCoOccurrenceDto,
  DailyOpsRevenueHourlyCategoryStackDto,
  DailyOpsRevenueHourlyMatrixDto,
  DailyOpsRevenueKpiDto,
  DailyOpsRevenueLocationDto,
  DailyOpsRevenueProductRow,
  DailyOpsRevenueRollingMediansDto,
  DailyOpsRevenueStaffRow,
  DailyOpsRevenueTableRow,
  DailyOpsRevenueTimeseriesDto,
  DailyOpsSimplePnLDto,
  DailyOpsWeekdayPatternRow,
  DailyOpsOrderPaymentRhythmPoint,
} from '~/types/daily-ops-revenue'

function buildQueryString(q: Record<string, string>): string {
  return new URLSearchParams(q).toString()
}

function timeseriesGranularity(startDate: string, endDate: string): 'day' | 'week' | 'month' {
  const days =
    Math.ceil((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1
  if (days <= 45) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

export type DailyOpsRevenueTabId = 'overview' | 'trends' | 'hourly' | 'dimensions'

export function useDailyOpsRevenueMetrics() {
  const route = useRoute()
  const onRevenuePage = route.path.includes('/daily-ops/revenue')
  const periodState = onRevenuePage
    ? useDailyOpsRevenueAnalyticsPeriod()
    : useDailyOpsRevenuePeriod()
  const { revenueQuery, primaryRange } = periodState
  const qs = computed(() => buildQueryString(revenueQuery.value))
  const cacheKey = computed(() => `rev-${qs.value}`)
  const gran = computed(() =>
    timeseriesGranularity(primaryRange.value.startDate, primaryRange.value.endDate),
  )

  const trendsActive = ref(false)
  const hourlyActive = ref(false)
  const dimensionsActive = ref(false)

  function useRevenueSlice<T>(
    suffix: string | (() => string),
    path: string,
    extraQuery?: () => Record<string, string>,
  ) {
    const key = computed(() =>
      `${cacheKey.value}-${typeof suffix === 'function' ? suffix() : suffix}`,
    )
    const { data, pending, error, refresh } = useAsyncData(
      key,
      () =>
        $fetch<T>(path, {
          query: { ...revenueQuery.value, ...extraQuery?.() },
        }),
      { watch: [qs] },
    )
    return {
      data: computed(() => data.value ?? null),
      pending,
      error,
      refresh,
    }
  }

  function useLazyRevenueSlice<T>(
    suffix: string | (() => string),
    path: string,
    active: Ref<boolean>,
    extraQuery?: () => Record<string, string>,
  ) {
    const key = computed(() =>
      `${cacheKey.value}-${typeof suffix === 'function' ? suffix() : suffix}`,
    )
    const { data, pending: fetchPending, error, refresh, execute, status } = useAsyncData(
      key,
      () =>
        $fetch<T>(path, {
          query: { ...revenueQuery.value, ...extraQuery?.() },
        }),
      { immediate: false },
    )

    watch(
      [qs, active],
      ([, isActive]) => {
        if (isActive) execute()
      },
      { immediate: true },
    )

    return {
      data: computed(() => data.value ?? null),
      pending: computed(() => active.value && (fetchPending.value || status.value === 'idle')),
      error,
      refresh,
    }
  }

  const summarySlice = useRevenueSlice<DailyOpsRevenueKpiDto>('summary', '/api/daily-ops/revenue/summary')
  const pnlSlice = useRevenueSlice<DailyOpsSimplePnLDto>('pnl', '/api/daily-ops/revenue/pnl')
  const locationsSlice = useRevenueSlice<DailyOpsRevenueLocationDto[]>(
    'locations',
    '/api/daily-ops/revenue/locations',
  )
  const dailyTimeseriesSlice = useRevenueSlice<DailyOpsRevenueTimeseriesDto>(
    'timeseries-day',
    '/api/daily-ops/revenue/timeseries',
    () => ({ granularity: 'day' }),
  )

  const timeseriesSlice = useLazyRevenueSlice<DailyOpsRevenueTimeseriesDto>(
    () => `timeseries-${gran.value}`,
    '/api/daily-ops/revenue/timeseries',
    trendsActive,
    () => ({ granularity: gran.value }),
  )
  const rollingMediansSlice = useLazyRevenueSlice<DailyOpsRevenueRollingMediansDto>(
    'rolling-medians',
    '/api/daily-ops/revenue/rolling-medians',
    trendsActive,
  )
  const categoriesSlice = useLazyRevenueSlice<DailyOpsRevenueCategoryDto[]>(
    'categories',
    '/api/daily-ops/revenue/categories',
    hourlyActive,
  )
  const productsSlice = useLazyRevenueSlice<DailyOpsRevenueProductRow[]>(
    'products',
    '/api/daily-ops/revenue/products',
    hourlyActive,
    () => ({ limit: '20' }),
  )
  const hourlyMatrixSlice = useLazyRevenueSlice<DailyOpsRevenueHourlyMatrixDto>(
    'hourly-matrix',
    '/api/daily-ops/revenue/hourly-matrix',
    hourlyActive,
  )
  const hourlyCategoryStackSlice = useLazyRevenueSlice<DailyOpsRevenueHourlyCategoryStackDto>(
    'hourly-category-stack',
    '/api/daily-ops/revenue/hourly-category-stack',
    hourlyActive,
  )
  const coOccurrenceSlice = useLazyRevenueSlice<DailyOpsRevenueCoOccurrenceDto>(
    'co-occurrence',
    '/api/daily-ops/revenue/co-occurrence',
    hourlyActive,
  )
  const locationSpacesSlice = useLazyRevenueSlice<
    Array<{ space: string; revenue: number; itemsCount: number; revenuePerItem: number }>
  >('per-location-space', '/api/daily-ops/revenue/per-location-space', dimensionsActive)
  const staffSlice = useLazyRevenueSlice<DailyOpsRevenueStaffRow[]>(
    'per-staff',
    '/api/daily-ops/revenue/per-staff',
    hourlyActive,
  )
  const tablesSlice = useLazyRevenueSlice<DailyOpsRevenueTableRow[]>(
    'per-table',
    '/api/daily-ops/revenue/per-table',
    hourlyActive,
  )
  const orderPaymentRhythmSlice = useLazyRevenueSlice<DailyOpsOrderPaymentRhythmPoint[]>(
    'order-payment-rhythm',
    '/api/daily-ops/revenue/order-payment-rhythm',
    hourlyActive,
  )

  function activateRevenueTab(tab: DailyOpsRevenueTabId) {
    if (tab === 'trends') trendsActive.value = true
    if (tab === 'hourly') hourlyActive.value = true
    if (tab === 'dimensions') dimensionsActive.value = true
  }

  /** Block shell only until summary KPIs are ready — pnl/locations load in place. */
  const overviewPending = computed(() => summarySlice.pending.value)

  function weekdayPattern(weekday: Ref<string> | string) {
    const w = computed(() => (typeof weekday === 'string' ? weekday : weekday.value))
    const key = computed(() => `${cacheKey.value}-weekday-${w.value}`)
    const { data, pending, error, refresh } = useAsyncData(
      key,
      () =>
        $fetch<DailyOpsWeekdayPatternRow[]>('/api/daily-ops/revenue/weekday-pattern', {
          query: { ...revenueQuery.value, weekday: w.value },
        }),
      { watch: [qs, w], immediate: trendsActive.value },
    )
    watch(trendsActive, (on) => {
      if (on) refresh()
    })
    return {
      data: computed(() => data.value ?? null),
      pending,
      error,
      refresh,
    }
  }

  return {
    revenueQuery,
    qs,
    overviewPending,
    activateRevenueTab,
    refreshPnl: pnlSlice.refresh,
    summary: summarySlice.data,
    pnl: pnlSlice.data,
    pnlPending: pnlSlice.pending,
    locations: locationsSlice.data,
    locationsPending: locationsSlice.pending,
    timeseries: timeseriesSlice.data,
    dailyTimeseries: dailyTimeseriesSlice.data,
    dailyTimeseriesPending: dailyTimeseriesSlice.pending,
    rollingMedians: rollingMediansSlice.data,
    categories: categoriesSlice.data,
    products: productsSlice.data,
    hourlyMatrix: hourlyMatrixSlice.data,
    hourlyCategoryStack: hourlyCategoryStackSlice.data,
    coOccurrence: coOccurrenceSlice.data,
    gran,
    staff: staffSlice.data,
    tables: tablesSlice.data,
    locationSpaces: locationSpacesSlice.data,
    orderPaymentRhythm: orderPaymentRhythmSlice.data,
    weekdayPattern,
  }
}

export function useDailyOpsProductivityRevenueMetrics() {
  const { revenueQuery } = useDailyOpsRevenuePeriod()
  const qs = computed(() => buildQueryString(revenueQuery.value))
  const cacheKey = computed(() => `prod-${qs.value}`)

  function useProdSlice<T>(suffix: string, path: string) {
    const key = computed(() => `${cacheKey.value}-${suffix}`)
    const { data, pending, error, refresh } = useAsyncData(
      key,
      () => $fetch<T>(path, { query: revenueQuery.value }),
      { watch: [qs] },
    )
    return {
      data: computed(() => data.value ?? null),
      pending,
      error,
      refresh,
    }
  }

  const staffSlice = useProdSlice<DailyOpsRevenueStaffRow[]>(
    'staff',
    '/api/daily-ops/productivity/workers-revenue',
  )
  const tablesSlice = useProdSlice<DailyOpsRevenueTableRow[]>(
    'tables',
    '/api/daily-ops/productivity/tables-revenue',
  )
  const rhythmSlice = useProdSlice<DailyOpsOrderPaymentRhythmPoint[]>(
    'rhythm',
    '/api/daily-ops/productivity/order-payment-rhythm',
  )

  const overviewPending = computed(
    () =>
      staffSlice.pending.value ||
      tablesSlice.pending.value ||
      rhythmSlice.pending.value,
  )

  return {
    revenueQuery,
    overviewPending,
    staff: staffSlice.data,
    tables: tablesSlice.data,
    orderPaymentRhythm: rhythmSlice.data,
  }
}
