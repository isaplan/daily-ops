<template>
  <section class="space-y-4">
    <div class="space-y-1">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Revenue Drilldown</h2>
      <p class="text-[11px] leading-snug text-gray-500">
        Per-hour table and line graph, last 5 same-weekday median, per-space revenue, and top-10 lists from snapshot data.
      </p>
    </div>

    <DailyOpsRevenueBenchmarkLegend :notes="data.coverageNotes" />

    <div class="flex justify-end">
      <div
        class="relative z-0 inline-flex shrink-0 flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-0.5"
        role="group"
        aria-label="Hourly revenue display mode"
      >
        <button
          type="button"
          class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          :class="hourlyViewMode === 'table' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
          :aria-pressed="hourlyViewMode === 'table'"
          title="Table"
          @click="hourlyViewMode = 'table'"
        >
          <UIcon name="i-lucide-table-2" class="size-4" aria-hidden="true" />
          <span class="sr-only">Table</span>
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          :class="hourlyViewMode === 'chart' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
          :aria-pressed="hourlyViewMode === 'chart'"
          title="Graph"
          @click="hourlyViewMode = 'chart'"
        >
          <UIcon name="i-lucide-chart-line" class="size-4" aria-hidden="true" />
          <span class="sr-only">Graph</span>
        </button>
      </div>
    </div>

    <DailyOpsRevenueHourlyLineChart
      v-if="hourlyViewMode === 'chart'"
      :rows="data.hourlyRows"
      :multi-day="data.multiDayRange"
    />
    <DailyOpsRevenueHourlyTable v-else :rows="data.hourlyRows" />

    <DailyOpsRevenueSpaceTable
      :rows="data.spaces"
      :initial-location-id="primaryLocationId"
      @config-saved="$emit('configSaved')"
    />

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

const { mode: hourlyViewMode } = useDailyOpsRevenueViewMode('revenue-drilldown-hourly-view', 'chart')
</script>
