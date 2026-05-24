<template>
  <div v-if="summary" class="space-y-4">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <p class="text-xs font-semibold uppercase text-gray-500">Totale omzet</p>
          <span
            v-if="leadLabel"
            class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600"
          >
            {{ leadLabel }}
          </span>
        </div>
        <p class="text-2xl font-bold">{{ formatEur(summary.revenue) }}</p>
        <p v-if="summary.revenueIncVat > 0" class="mt-1 text-xs text-gray-600">
          Incl. BTW ({{ leadLabel ?? 'bron' }}): {{ formatEur(summary.revenueIncVat) }}
        </p>
        <p v-if="summary.borkRevenueIncVat > 0" class="text-xs text-gray-500">
          Bork API incl. BTW: {{ formatEur(summary.borkRevenueIncVat) }}
          <span class="text-gray-400">(Datalab)</span>
        </p>
        <p
          v-if="borkExGap != null && borkExGap !== 0"
          class="text-xs text-amber-700"
        >
          Basis vs Bork (ex): {{ formatEur(borkExGap) }}
        </p>
        <DailyOpsRevenueKpiVs60Line
          v-if="summary.vs60d"
          :metric="summary.vs60d.revenue"
          :benchmark-label="summary.vs60d.label"
        />
        <DailyOpsRevenueDeltaBadge v-else-if="summary.compareDelta" :delta="summary.compareDelta" />
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase text-gray-500">Totale stuks</p>
        <p class="text-2xl font-bold">{{ summary.itemsCount.toLocaleString('nl-NL') }}</p>
        <DailyOpsRevenueKpiVs60Line
          v-if="summary.vs60d"
          :metric="summary.vs60d.itemsCount"
          :benchmark-label="summary.vs60d.label"
          format="number"
        />
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase text-gray-500">Gem. omzet / dag</p>
        <p class="text-2xl font-bold">{{ formatEur(summary.avgRevenuePerDay) }}</p>
        <DailyOpsRevenueKpiVs60Line
          v-if="summary.vs60d"
          :metric="summary.vs60d.avgRevenuePerDay"
          :benchmark-label="summary.vs60d.label"
        />
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase text-gray-500">Gem. € / stuk</p>
        <p class="text-2xl font-bold">{{ formatEur(summary.revenuePerItem) }}</p>
        <DailyOpsRevenueKpiVs60Line
          v-if="summary.vs60d"
          :metric="summary.vs60d.revenuePerItem"
          :benchmark-label="summary.vs60d.label"
          format="eurPerItem"
        />
      </div>
    </div>

    <DailyOpsRevenueDailyBreakdown
      :timeseries="dailyTimeseries"
      :pending="dailyPending"
    />
  </div>
</template>

<script setup lang="ts">
import type { DailyOpsRevenueKpiDto, DailyOpsRevenueTimeseriesDto } from '~/types/daily-ops-revenue'

const props = defineProps<{
  summary: DailyOpsRevenueKpiDto | null
  dailyTimeseries?: DailyOpsRevenueTimeseriesDto | null
  dailyPending?: boolean
}>()

const { formatEur } = useDashboardEurFormat()

const leadLabel = computed(() => {
  const s = props.summary?.leadSource
  if (s === 'inbox_basis') return 'Basis'
  if (s === 'bork_api') return 'Bork'
  return s === 'unknown' ? null : s
})

const borkExGap = computed(() => {
  const s = props.summary
  if (!s || s.leadSource !== 'inbox_basis') return null
  return Math.round((s.borkRevenueExVat - s.revenue) * 100) / 100
})
</script>
