<template>
  <UCard
    v-if="detail && hasHourlyRows"
    class="border-2 border-gray-900 bg-white! ring-0 shadow-none"
  >
    <template #header>
      <h2 class="text-lg font-semibold text-gray-900">Hourly revenue &amp; labor productivity</h2>
    </template>
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-xs text-gray-500">
        Hourly revenue from Bork aggregates with Eitje labor productivity per hour.
        Paid time uses closed ticket hour; order time uses Bork order-entry hour.
      </p>
      <UiPillTabs
        v-model="hourlyBasis"
        :options="hourlyBasisOptions"
        aria-label="Hourly revenue time basis"
      />
    </div>
    <div class="mb-4 flex flex-col gap-3">
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <UiPillTabs
          v-model="viewMode"
          :options="viewModeOptions"
          aria-label="Hourly revenue display mode"
        />
        <UiPillTabs
          v-model="venueFilter"
          :options="venueFilterOptions"
          aria-label="Filter hourly chart by venue"
        />
      </div>
      <div class="flex justify-end">
        <UiPillTabs
          v-model="metricFilter"
          :options="metricFilterOptions"
          aria-label="Filter by metric"
        />
      </div>
    </div>
    <div>
      <DailyOpsTodayHourlyDualAxisChart
        v-if="viewMode === 'chart' && activeHourlyRows.length > 0"
        :rows="activeHourlyRows"
        :location-filter="venueFilter"
        :metric-filter="metricFilter"
        :basis-label="activeBasisLabel"
      />
      <div v-else-if="viewMode === 'table' && activeHourlyRows.length > 0">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Hourly · {{ activeBasisLabel }} (calendar hour)
        </p>
        <div class="max-h-56 overflow-y-auto rounded border border-gray-200">
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead class="sticky top-0 bg-gray-50 text-xs text-gray-600">
              <tr>
                <th class="px-3 py-2 align-bottom" rowspan="2">Hour</th>
                <th
                  v-for="location in tableLocationColumns"
                  :key="location.locationId"
                  class="border-l border-gray-200 px-3 py-2 text-center font-semibold text-gray-800"
                  :colspan="locationHeaderColspan"
                >
                  {{ location.locationName }}
                </th>
              </tr>
              <tr>
                <th
                  v-for="column in tableMetricColumns"
                  :key="column.key"
                  class="px-3 py-2 text-right"
                  :class="column.isFirstForLocation ? 'border-l border-gray-200' : ''"
                >
                  {{ column.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in tableHourlyRows"
                :key="`th-${row.calendarHour}`"
                class="border-t border-gray-100"
              >
                <td class="px-3 py-1.5 tabular-nums">{{ String(row.calendarHour).padStart(2, '0') }}:00</td>
                <td
                  v-for="column in tableMetricColumns"
                  :key="`${row.calendarHour}-${column.key}`"
                  class="px-3 py-1.5 text-right tabular-nums"
                  :class="column.isFirstForLocation ? 'border-l border-gray-100' : ''"
                >
                  {{ formatMetric(row, column) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div
        v-else
        class="rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600"
      >
        Order-time hourly data is not in the current snapshots yet. Rebuild Bork V2 aggregates and Daily Ops snapshots to populate this tab.
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { DailyOpsTodayRevenueDetailDto } from '~/types/daily-ops-dashboard'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'

const props = defineProps<{
  detail?: DailyOpsTodayRevenueDetailDto | null
}>()

const { formatEur } = useDashboardEurFormat()
const { mode: viewMode } = useDailyOpsRevenueViewMode('today-hourly-view', 'chart')

type HourlyRow = DailyOpsTodayRevenueDetailDto['apiHourlyByCalendarHour'][number]
type LocationMetric = HourlyRow['locations'][number]
type LocationColumn = Pick<LocationMetric, 'locationId' | 'locationName'>
type HourlyBasis = 'paid' | 'ordered'
type MetricFilter = 'all' | 'revenue' | 'productivity'
type MetricColumn = LocationColumn & {
  key: string
  label: string
  metric: 'revenue' | 'productivity'
  isFirstForLocation: boolean
}

const hourlyBasis = ref<HourlyBasis>('paid')
const venueFilter = ref<string>('all')
const metricFilter = ref<MetricFilter>('all')

const metricFilterOptions: { value: MetricFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'productivity', label: 'Labor productivity' },
]

function locationMetricVisible(metric: LocationMetric): boolean {
  if (metricFilter.value === 'revenue') return metric.revenue > 0
  if (metricFilter.value === 'productivity') {
    return metric.revenuePerLaborHour != null && Number.isFinite(metric.revenuePerLaborHour)
  }
  return (
    metric.revenue > 0
    || metric.laborHours > 0
    || (metric.revenuePerLaborHour != null && Number.isFinite(metric.revenuePerLaborHour))
  )
}

const paidHourlyRows = computed((): HourlyRow[] => props.detail?.apiHourlyByCalendarHour ?? [])
const orderedHourlyRows = computed((): HourlyRow[] => props.detail?.orderHourlyByCalendarHour ?? [])

const hourlyBasisOptions: { value: HourlyBasis; label: string }[] = [
  { value: 'paid', label: 'Paid time' },
  { value: 'ordered', label: 'Order time' },
]

const viewModeOptions = [
  { value: 'chart', label: 'Graph' },
  { value: 'table', label: 'Table' },
] as const

const venueFilterOptions = [
  { value: 'all', label: 'All' },
  ...DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((location) => ({
    value: location.locationId,
    label: location.short,
  })),
]

const activeHourlyRows = computed((): HourlyRow[] => {
  if (hourlyBasis.value === 'ordered') return orderedHourlyRows.value
  return paidHourlyRows.value
})

const activeBasisLabel = computed(() => hourlyBasis.value === 'ordered' ? 'order time' : 'paid time')

const hasHourlyRows = computed(() => paidHourlyRows.value.length > 0 || orderedHourlyRows.value.length > 0)

const tableLocationColumns = computed((): LocationColumn[] => {
  if (venueFilter.value === 'all') return locationColumns.value
  return locationColumns.value.filter((location: LocationColumn) => location.locationId === venueFilter.value)
})

const locationColumns = computed((): LocationColumn[] => {
  return activeHourlyRows.value
    .find((row: HourlyRow) => row.locations.length > 0)
    ?.locations.map((location: LocationMetric) => ({
      locationId: location.locationId,
      locationName: location.locationName,
    })) ?? []
})

const locationHeaderColspan = computed(() => (metricFilter.value === 'all' ? 2 : 1))

const tableHourlyRows = computed((): HourlyRow[] => {
  const rows = venueFilter.value === 'all'
    ? activeHourlyRows.value
    : activeHourlyRows.value.filter((row: HourlyRow) =>
        locationMetricVisible(getLocationMetric(row, venueFilter.value)),
      )

  if (metricFilter.value === 'all') return rows

  return rows.filter((row: HourlyRow) => {
    const locations = venueFilter.value === 'all'
      ? tableLocationColumns.value
      : tableLocationColumns.value.filter((location: LocationColumn) => location.locationId === venueFilter.value)
    return locations.some((location: LocationColumn) =>
      locationMetricVisible(getLocationMetric(row, location.locationId)),
    )
  })
})

const getLocationMetric = (row: HourlyRow, locationId: string): LocationMetric => {
  return row.locations.find((location) => location.locationId === locationId) ?? {
    locationId,
    locationName: '',
    revenue: 0,
    laborHours: 0,
    revenuePerLaborHour: null,
  }
}

const tableMetricColumns = computed((): MetricColumn[] => {
  const columns = tableLocationColumns.value.flatMap((location: LocationColumn) => [
    {
      ...location,
      key: `${location.locationId}-revenue`,
      label: 'Revenue',
      metric: 'revenue' as const,
      isFirstForLocation: true,
    },
    {
      ...location,
      key: `${location.locationId}-productivity`,
      label: '€/labor h',
      metric: 'productivity' as const,
      isFirstForLocation: false,
    },
  ])

  if (metricFilter.value === 'revenue') {
    return columns.filter((column: MetricColumn) => column.metric === 'revenue')
  }
  if (metricFilter.value === 'productivity') {
    return columns.filter((column: MetricColumn) => column.metric === 'productivity')
  }
  return columns
})

const formatMetric = (row: HourlyRow, column: MetricColumn) => {
  const metric = getLocationMetric(row, column.locationId)
  if (column.metric === 'revenue') return formatEur(metric.revenue)
  return formatProductivity(metric.revenuePerLaborHour)
}

const formatProductivity = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${formatEur(value)}/h`
}
</script>
