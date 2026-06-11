<template>
  <div class="@container/weekly-hours space-y-3 border-t border-gray-100 pt-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Weekly hours</p>
      <USelectMenu
        v-model="preset"
        :items="presetOptions"
        value-key="value"
        size="xs"
        class="w-[7.5rem]"
      />
    </div>

    <div v-if="pending" class="text-xs text-gray-500">Loading weekly hours…</div>
    <div v-else-if="error" class="text-xs text-red-600">{{ error }}</div>
    <div v-else-if="data?.data_gap" class="text-xs text-amber-700">
      No Eitje hours in this range for this member.
    </div>
    <template v-else-if="data">
      <div class="grid min-w-0 grid-cols-2 gap-2 @2xl/weekly-hours:grid-cols-4">
        <div class="min-w-0 rounded-lg border-2 border-gray-900 bg-white p-2 text-left shadow-none @2xl/weekly-hours:p-3">
          <p class="truncate text-[10px] font-medium text-gray-500 @2xl/weekly-hours:text-xs">Worked</p>
          <p class="mt-1 truncate text-sm font-semibold tabular-nums text-gray-900 @2xl/weekly-hours:mt-1.5 @2xl/weekly-hours:text-lg">
            {{ fmt(data.totals.worked_hours) }}h
          </p>
        </div>
        <div
          v-if="data.contract_weekly != null"
          class="min-w-0 rounded-lg border-2 border-gray-900 bg-white p-2 text-left shadow-none @2xl/weekly-hours:p-3"
        >
          <p class="truncate text-[10px] font-medium text-gray-500 @2xl/weekly-hours:text-xs">Contract</p>
          <p class="mt-1 truncate text-sm font-semibold tabular-nums text-gray-900 @2xl/weekly-hours:mt-1.5 @2xl/weekly-hours:text-lg">
            {{ fmt(data.totals.contract_hours ?? 0) }}h
          </p>
        </div>
        <div
          v-if="data.totals.delta_vs_contract != null"
          class="min-w-0 rounded-lg border-2 border-gray-900 bg-white p-2 text-left shadow-none @2xl/weekly-hours:p-3"
        >
          <p class="truncate text-[10px] font-medium text-gray-500 @2xl/weekly-hours:text-xs">Δ vs contract</p>
          <p class="mt-1 truncate text-sm font-semibold tabular-nums text-gray-900 @2xl/weekly-hours:mt-1.5 @2xl/weekly-hours:text-lg">
            {{ signed(data.totals.delta_vs_contract) }}h
          </p>
        </div>
        <div class="min-w-0 rounded-lg border-2 border-gray-900 bg-white p-2 text-left shadow-none @2xl/weekly-hours:p-3">
          <p class="truncate text-[10px] font-medium text-gray-500 @2xl/weekly-hours:text-xs">Roster</p>
          <p class="mt-1 truncate text-sm font-semibold tabular-nums text-gray-900 @2xl/weekly-hours:mt-1.5 @2xl/weekly-hours:text-lg">
            {{ fmt(data.totals.planned_hours) }}h
          </p>
        </div>
      </div>

      <p v-if="data.planned_coverage_pct != null && data.planned_coverage_pct < 80" class="text-[10px] text-amber-700">
        Roster data partial ({{ Math.round(data.planned_coverage_pct) }}% of active weeks).
      </p>

      <StaffWeeklyHoursChart v-if="data.weeks.length" :weeks="data.weeks" :contract-weekly="data.contract_weekly" />

      <p class="text-[10px] text-gray-500">
        {{ formatIsoDate(data.range_start) }} – {{ formatIsoDate(data.range_end) }}
        <span v-if="data.contract_weekly != null"> · {{ data.contract_weekly }}h/wk contract</span>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import StaffWeeklyHoursChart from '~/components/daily-ops/staff/StaffWeeklyHoursChart.vue'

import type { StaffWeeklyHoursPreset } from '~/types/daily-ops-staff'

const props = defineProps<{ memberId: string }>()

const memberIdRef = computed(() => props.memberId)
const { preset, data, pending, error } = useStaffWeeklyHours(memberIdRef)

const presetOptions: { label: string; value: StaffWeeklyHoursPreset }[] = [
  { label: 'YTD', value: 'ytd' },
  { label: '3 months', value: '3m' },
  { label: '6 months', value: '6mo' },
]

function fmt(n: number) {
  return Number.isFinite(n) ? n.toFixed(1) : '—'
}

function signed(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`
}

function formatIsoDate(val: string) {
  const [y, mo, d] = val.split('-').map(Number)
  if (!y || !mo || !d) return val
  return new Date(y, mo - 1, d).toLocaleDateString()
}
</script>
