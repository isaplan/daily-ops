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

export function useDailyOpsRevenueMetrics() {
  const { revenueQuery, primaryRange } = useDailyOpsRevenuePeriod()
  const { pnlQueryParams } = useDailyOpsRevenuePnlAssumptions()
  const mergedQuery = computed(() => ({
    ...revenueQuery.value,
    ...pnlQueryParams.value,
  }))
  const qs = computed(() => buildQueryString(mergedQuery.value))
  const cacheKey = computed(() => `rev-${qs.value}`)
  const gran = computed(() =>
    timeseriesGranularity(primaryRange.value.startDate, primaryRange.value.endDate),
  )

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
          query: { ...mergedQuery.value, ...extraQuery?.() },
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

  const summarySlice = useRevenueSlice<DailyOpsRevenueKpiDto>('summary', '/api/daily-ops/revenue/summary')
  const pnlSlice = useRevenueSlice<DailyOpsSimplePnLDto>('pnl', '/api/daily-ops/revenue/pnl')
  const locationsSlice = useRevenueSlice<DailyOpsRevenueLocationDto[]>(
    'locations',
    '/api/daily-ops/revenue/locations',
  )
  const timeseriesSlice = useRevenueSlice<DailyOpsRevenueTimeseriesDto>(
    () => `timeseries-${gran.value}`,
    '/api/daily-ops/revenue/timeseries',
    () => ({ granularity: gran.value }),
  )
  const rollingMediansSlice = useRevenueSlice<DailyOpsRevenueRollingMediansDto>(
    'rolling-medians',
    '/api/daily-ops/revenue/rolling-medians',
  )
  const categoriesSlice = useRevenueSlice<DailyOpsRevenueCategoryDto[]>(
    'categories',
    '/api/daily-ops/revenue/categories',
  )
  const productsSlice = useRevenueSlice<DailyOpsRevenueProductRow[]>(
    'products',
    '/api/daily-ops/revenue/products',
    () => ({ limit: '20' }),
  )
  const hourlyMatrixSlice = useRevenueSlice<DailyOpsRevenueHourlyMatrixDto>(
    'hourly-matrix',
    '/api/daily-ops/revenue/hourly-matrix',
  )
  const hourlyCategoryStackSlice = useRevenueSlice<DailyOpsRevenueHourlyCategoryStackDto>(
    'hourly-category-stack',
    '/api/daily-ops/revenue/hourly-category-stack',
  )
  const coOccurrenceSlice = useRevenueSlice<DailyOpsRevenueCoOccurrenceDto>(
    'co-occurrence',
    '/api/daily-ops/revenue/co-occurrence',
  )
  const staffSlice = useRevenueSlice<DailyOpsRevenueStaffRow[]>(
    'per-staff',
    '/api/daily-ops/revenue/per-staff',
  )
  const tablesSlice = useRevenueSlice<DailyOpsRevenueTableRow[]>(
    'per-table',
    '/api/daily-ops/revenue/per-table',
  )
  const locationSpacesSlice = useRevenueSlice<
    Array<{ space: string; revenue: number; itemsCount: number; revenuePerItem: number }>
  >('per-location-space', '/api/daily-ops/revenue/per-location-space')
  const orderPaymentRhythmSlice = useRevenueSlice<DailyOpsOrderPaymentRhythmPoint[]>(
    'order-payment-rhythm',
    '/api/daily-ops/revenue/order-payment-rhythm',
  )

  const overviewPending = computed(
    () =>
      summarySlice.pending.value ||
      pnlSlice.pending.value ||
      locationsSlice.pending.value,
  )

  function weekdayPattern(weekday: Ref<string> | string) {
    const w = computed(() => (typeof weekday === 'string' ? weekday : weekday.value))
    const key = computed(() => `${cacheKey.value}-weekday-${w.value}`)
    const { data, pending, error, refresh } = useAsyncData(
      key,
      () =>
        $fetch<DailyOpsWeekdayPatternRow[]>('/api/daily-ops/revenue/weekday-pattern', {
          query: { ...mergedQuery.value, weekday: w.value },
        }),
      { watch: [qs, w] },
    )
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
    summary: summarySlice.data,
    pnl: pnlSlice.data,
    locations: locationsSlice.data,
    timeseries: timeseriesSlice.data,
    rollingMedians: rollingMediansSlice.data,
    categories: categoriesSlice.data,
    products: productsSlice.data,
    hourlyMatrix: hourlyMatrixSlice.data,
    hourlyCategoryStack: hourlyCategoryStackSlice.data,
    coOccurrence: coOccurrenceSlice.data,
    mergedQuery,
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
