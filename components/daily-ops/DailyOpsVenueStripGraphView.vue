<template>
  <DailyOpsPeriodBreakdownChart
    v-if="hasChartData"
    :breakdown="breakdown"
    :table-occupancy="tableOccupancy"
    :business-date="businessDate"
    :subtitle="chartSubtitle"
  />

  <p v-else class="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
    No breakdown data for this period.
  </p>

  <p v-if="breakdown.coverageNote" class="text-xs text-amber-700">
    {{ breakdown.coverageNote }}
  </p>
</template>

<script setup lang="ts">
import type { PeriodBreakdownDto } from '~/types/daily-ops-dashboard'
import type { DailyOpsTableOccupancyKpisDto } from '~/types/daily-ops-venue-tables'

const props = defineProps<{
  breakdown: PeriodBreakdownDto
  periodLabel: string
  businessDate?: string | null
  tableOccupancy?: DailyOpsTableOccupancyKpisDto | null
}>()

const hasChartData = computed(
  () => props.breakdown.byVenue.some((v) => v.rows.length > 0),
)

const chartSubtitle = computed(
  () => `${props.periodLabel} · ${props.breakdown.granularity} buckets`,
)
</script>
