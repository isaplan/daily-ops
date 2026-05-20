import type {
  DailyOpsRevenueCategoryDto,
  DailyOpsRevenueCoOccurrenceDto,
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

export function useDailyOpsRevenueMetrics() {
  const { revenueQuery } = useDailyOpsRevenuePeriod()
  const qs = computed(() => buildQueryString(revenueQuery.value))

  const summary = useFetch<DailyOpsRevenueKpiDto>(
    () => `/api/daily-ops/revenue/summary?${qs.value}`,
    { watch: [qs], key: () => `rev-summary-${qs.value}` },
  )

  const pnl = useFetch<DailyOpsSimplePnLDto>(
    () => `/api/daily-ops/revenue/pnl?${qs.value}`,
    { watch: [qs], key: () => `rev-pnl-${qs.value}` },
  )

  const locations = useFetch<DailyOpsRevenueLocationDto[]>(
    () => `/api/daily-ops/revenue/locations?${qs.value}`,
    { watch: [qs], key: () => `rev-loc-${qs.value}` },
  )

  const timeseries = useFetch<DailyOpsRevenueTimeseriesDto>(
    () => `/api/daily-ops/revenue/timeseries?${qs.value}&granularity=day`,
    { watch: [qs], key: () => `rev-ts-${qs.value}` },
  )

  const rollingMedians = useFetch<DailyOpsRevenueRollingMediansDto>(
    () => `/api/daily-ops/revenue/rolling-medians?${qs.value}`,
    { watch: [qs], key: () => `rev-roll-${qs.value}` },
  )

  const categories = useFetch<DailyOpsRevenueCategoryDto[]>(
    () => `/api/daily-ops/revenue/categories?${qs.value}`,
    { watch: [qs], key: () => `rev-cat-${qs.value}` },
  )

  const products = useFetch<DailyOpsRevenueProductRow[]>(
    () => `/api/daily-ops/revenue/products?${qs.value}&limit=20`,
    { watch: [qs], key: () => `rev-prod-${qs.value}` },
  )

  const hourlyMatrix = useFetch<DailyOpsRevenueHourlyMatrixDto>(
    () => `/api/daily-ops/revenue/hourly-matrix?${qs.value}`,
    { watch: [qs], key: () => `rev-hour-${qs.value}` },
  )

  const coOccurrence = useFetch<DailyOpsRevenueCoOccurrenceDto>(
    () => `/api/daily-ops/revenue/co-occurrence?${qs.value}`,
    { watch: [qs], key: () => `rev-co-${qs.value}` },
  )

  const staff = useFetch<DailyOpsRevenueStaffRow[]>(
    () => `/api/daily-ops/revenue/per-staff?${qs.value}`,
    { watch: [qs], key: () => `rev-staff-${qs.value}` },
  )

  const tables = useFetch<DailyOpsRevenueTableRow[]>(
    () => `/api/daily-ops/revenue/per-table?${qs.value}`,
    { watch: [qs], key: () => `rev-tbl-${qs.value}` },
  )

  const locationSpaces = useFetch<
    Array<{ space: string; revenue: number; itemsCount: number; revenuePerItem: number }>
  >(() => `/api/daily-ops/revenue/per-location-space?${qs.value}`, {
    watch: [qs],
    key: () => `rev-space-${qs.value}`,
  })

  const orderPaymentRhythm = useFetch<DailyOpsOrderPaymentRhythmPoint[]>(
    () => `/api/daily-ops/revenue/order-payment-rhythm?${qs.value}`,
    { watch: [qs], key: () => `rev-rhythm-${qs.value}` },
  )

  function weekdayPattern(weekday: string) {
    return useFetch<DailyOpsWeekdayPatternRow[]>(
      () => `/api/daily-ops/revenue/weekday-pattern?${qs.value}&weekday=${weekday}`,
      { watch: [qs], key: () => `rev-wd-${weekday}-${qs.value}` },
    )
  }

  return {
    revenueQuery,
    summary,
    pnl,
    locations,
    timeseries,
    rollingMedians,
    categories,
    products,
    hourlyMatrix,
    coOccurrence,
    staff,
    tables,
    locationSpaces,
    orderPaymentRhythm,
    weekdayPattern,
  }
}

export function useDailyOpsProductivityRevenueMetrics() {
  const { revenueQuery } = useDailyOpsRevenuePeriod()
  const qs = computed(() => buildQueryString(revenueQuery.value))

  const staff = useFetch<DailyOpsRevenueStaffRow[]>(
    () => `/api/daily-ops/productivity/workers-revenue?${qs.value}`,
    { watch: [qs], key: () => `prod-staff-${qs.value}` },
  )

  const tables = useFetch<DailyOpsRevenueTableRow[]>(
    () => `/api/daily-ops/productivity/tables-revenue?${qs.value}`,
    { watch: [qs], key: () => `prod-tbl-${qs.value}` },
  )

  const orderPaymentRhythm = useFetch<DailyOpsOrderPaymentRhythmPoint[]>(
    () => `/api/daily-ops/productivity/order-payment-rhythm?${qs.value}`,
    { watch: [qs], key: () => `prod-rhythm-${qs.value}` },
  )

  return { revenueQuery, staff, tables, orderPaymentRhythm }
}
