<template>
  <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
    <DailyOpsChartExpandShell
      expand-aria-label="Expand hourly revenue chart"
      modal-aria-label="Hourly revenue chart expanded"
    >
      <template #header>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Hourly Revenue</h3>
            <p class="text-xs text-gray-500">{{ subtitle }}</p>
          </div>
          <div class="flex gap-3 text-xs text-gray-600">
            <span class="inline-flex items-center gap-1.5">
              <span class="h-0.5 w-5 bg-gray-900" />
              Current
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-0.5 w-5 bg-gray-400" />
              Median
            </span>
          </div>
        </div>
      </template>

      <template #default="{ width, expanded }">
        <DailyOpsRevenueHourlyLineChartPlot
          :rows="rows"
          :multi-day="multiDay"
          :container-width="width"
          :expanded="expanded"
          :svg-class="expanded ? 'block h-full w-full min-h-[16rem]' : undefined"
        />
      </template>
    </DailyOpsChartExpandShell>
  </div>
</template>

<script setup lang="ts">
import type { DailyOpsRevenueDrilldownHourlyRowDto } from '~/types/daily-ops-dashboard'

const props = defineProps<{
  rows: DailyOpsRevenueDrilldownHourlyRowDto[]
  /** When true, revenue per hour is summed across multiple days in the period. */
  multiDay?: boolean
}>()

const hasActiveBenchmark = computed(() =>
  props.rows.some((row: DailyOpsRevenueDrilldownHourlyRowDto) => row.revenue > 0 && row.benchmarkRevenue != null),
)
const subtitle = computed(() => {
  if (hasActiveBenchmark.value) {
    return props.multiDay
      ? 'Period total per hour vs sum of last-5 same-weekday medians (one per day in range). Service hours 11:00 → 03:00.'
      : 'Current revenue against last 5 same-weekday median, shown for service hours 11:00 → 03:00.'
  }
  return props.multiDay
    ? 'No median benchmark for this week yet — need hourly snapshot history for each weekday in the range.'
    : 'No median benchmark is available for the active revenue hours yet.'
})
</script>
