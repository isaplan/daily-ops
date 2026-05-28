<template>
  <section class="space-y-4">
    <div class="space-y-1">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Revenue Drilldown</h2>
      <p class="text-[11px] leading-snug text-gray-500">
        Per-hour table and line graph, last 5 same-weekday median, per-space revenue, and top-10 lists from snapshot data.
      </p>
    </div>

    <DailyOpsRevenueBenchmarkLegend :notes="data.coverageNotes" />

    <DailyOpsRevenueHourlyLineChart :rows="data.hourlyRows" />
    <DailyOpsRevenueHourlyTable :rows="data.hourlyRows" />

    <div class="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <DailyOpsRevenueSpaceTable
        :rows="data.spaces"
        :initial-location-id="primaryLocationId"
        @config-saved="$emit('configSaved')"
      />
      <UCard class="border-2 border-gray-900 bg-white! ring-0 shadow-none">
        <template #header>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Calculation Notes</h3>
        </template>
        <p class="text-xs leading-relaxed text-gray-600">
          {{ data.estimatesNote }}
        </p>
      </UCard>
    </div>

    <DailyOpsRevenueTop10Grid :top10="data.top10" />
  </section>
</template>

<script setup lang="ts">
import type { DailyOpsRevenueDrilldownDto } from '~/types/daily-ops-dashboard'

defineProps<{
  data: DailyOpsRevenueDrilldownDto
  primaryLocationId?: string | null
}>()

defineEmits<{
  configSaved: []
}>()
</script>
