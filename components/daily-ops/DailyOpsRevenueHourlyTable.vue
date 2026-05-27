<template>
  <div class="overflow-hidden rounded-lg border-2 border-gray-900 bg-white">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-3 py-2 text-left font-semibold">Business hour</th>
            <th class="px-3 py-2 text-right font-semibold">Revenue</th>
            <th class="px-3 py-2 text-right font-semibold">Median</th>
            <th class="px-3 py-2 text-right font-semibold">Profit</th>
            <th
              v-for="location in locationHeaders"
              :key="location.locationId"
              class="px-3 py-2 text-right font-semibold"
            >
              {{ location.locationName }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="row in visibleRows"
            :key="row.calendarHour"
            class="hover:bg-gray-50"
          >
            <td class="whitespace-nowrap px-3 py-2 font-medium text-gray-900">{{ row.hourLabel }}</td>
            <td class="whitespace-nowrap px-3 py-2 text-right font-semibold text-gray-900">{{ formatEur(row.revenue) }}</td>
            <td class="whitespace-nowrap px-3 py-2 text-right text-gray-600">
              {{ row.benchmarkRevenue == null ? '—' : formatEur(row.benchmarkRevenue) }}
            </td>
            <td
              class="whitespace-nowrap px-3 py-2 text-right font-semibold"
              :class="profitClass(row.profit)"
            >
              {{ formatEur(row.profit) }}
            </td>
            <td
              v-for="location in locationHeaders"
              :key="`${row.calendarHour}-${location.locationId}`"
              class="whitespace-nowrap px-3 py-2 text-right text-gray-700"
            >
              {{ formatEur(locationRevenue(row, location.locationId)) }}
            </td>
          </tr>
          <tr v-if="visibleRows.length === 0">
            <td colspan="8" class="px-3 py-8 text-center text-sm text-gray-500">
              No hourly revenue snapshot rows available for this period.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  DailyOpsRevenueDrilldownHourlyRowDto,
  DailyOpsRevenueDrilldownLocationHourDto,
} from '~/types/daily-ops-dashboard'

const props = defineProps<{
  rows: DailyOpsRevenueDrilldownHourlyRowDto[]
}>()

const { formatEur } = useDashboardEurFormat()

const HIDDEN_BUSINESS_AXIS_HOURS = new Set([8, 9, 10, 3, 4, 5, 7])

function isVisibleBusinessAxisHour(hour: number): boolean {
  return !HIDDEN_BUSINESS_AXIS_HOURS.has(hour)
}

const visibleRows = computed<DailyOpsRevenueDrilldownHourlyRowDto[]>(() =>
  props.rows
    .filter(
      (row: DailyOpsRevenueDrilldownHourlyRowDto) =>
        isVisibleBusinessAxisHour(row.calendarHour) &&
        (row.revenue > 0 || row.benchmarkRevenue != null),
    )
    .sort(
      (a: DailyOpsRevenueDrilldownHourlyRowDto, b: DailyOpsRevenueDrilldownHourlyRowDto) =>
        businessHourIndex(a.calendarHour) - businessHourIndex(b.calendarHour),
    ),
)

const locationHeaders = computed<DailyOpsRevenueDrilldownLocationHourDto[]>(() => {
  const first = props.rows.find((row: DailyOpsRevenueDrilldownHourlyRowDto) => row.locations.length > 0)
  return first?.locations ?? []
})

function locationRevenue(row: DailyOpsRevenueDrilldownHourlyRowDto, locationId: string): number {
  return row.locations.find((location) => location.locationId === locationId)?.revenue ?? 0
}

function businessHourIndex(hour: number): number {
  return (Math.min(23, Math.max(0, hour)) - 8 + 24) % 24
}

function profitClass(value: number): string {
  if (value > 0) return 'text-[#5B9A6F]'
  if (value < 0) return 'text-[#C97B7B]'
  return 'text-gray-500'
}
</script>
