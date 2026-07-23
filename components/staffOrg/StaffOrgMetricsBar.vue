<template>
  <div class="space-y-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
    <div class="flex flex-wrap items-center gap-4">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Open hours</p>
        <p class="font-semibold tabular-nums text-gray-900">{{ openHours.toFixed(1) }}u</p>
      </div>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Assigned (FT)</p>
        <p class="font-semibold tabular-nums text-gray-900">{{ assignedHours.toFixed(1) }}u</p>
      </div>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Est. labor</p>
        <p class="font-semibold tabular-nums text-gray-900">€{{ laborCost.toFixed(0) }}</p>
      </div>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Headcount</p>
        <p class="font-semibold tabular-nums text-gray-900">{{ headcount }}</p>
      </div>
      <div v-if="underMinCount > 0" class="text-amber-700">
        {{ underMinCount }} cell(s) under min
      </div>
      <div v-if="overMaxCount > 0" class="text-red-600">
        {{ overMaxCount }} cell(s) over max
      </div>
    </div>

    <div
      v-if="productivity"
      class="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3"
    >
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Est. monthly rev</p>
        <p class="font-semibold tabular-nums text-gray-900">
          €{{ formatEur(productivity.monthlyRevenue) }}
        </p>
      </div>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Weekly rev</p>
        <p class="font-semibold tabular-nums text-gray-900">
          €{{ formatEur(productivity.weeklyRevenue) }}
        </p>
      </div>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Min €/h (FT)</p>
        <p class="font-semibold tabular-nums text-gray-900">
          {{ productivity.minLaborProductivity > 0
            ? `€${productivity.minLaborProductivity.toFixed(0)}`
            : '—' }}
        </p>
      </div>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Hour budget</p>
        <p class="font-semibold tabular-nums text-gray-900">
          {{ productivity.hourBudget != null ? `${productivity.hourBudget.toFixed(0)}u` : '—' }}
        </p>
      </div>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Implied €/h</p>
        <p
          class="font-semibold tabular-nums"
          :class="impliedClass"
        >
          {{ productivity.impliedProductivity != null
            ? `€${productivity.impliedProductivity.toFixed(0)}`
            : '—' }}
        </p>
      </div>
      <div
        v-if="productivity.hoursOverBudget != null && productivity.hourBudget != null"
        class="text-sm font-medium"
        :class="gapClass"
      >
        <template v-if="productivity.hoursOverBudget > 0.5">
          +{{ productivity.hoursOverBudget.toFixed(0) }}u over budget (too many hours)
        </template>
        <template v-else-if="productivity.hoursOverBudget < -0.5">
          {{ Math.abs(productivity.hoursOverBudget).toFixed(0) }}u under budget (room for more FT hours)
        </template>
        <template v-else>
          On hour budget
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: StaffOrgMetricsBar
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-22T22:45:00.000Z
 * @description: Metrics strip — hours + revenue/productivity budget
 * @last-fix: [2026-07-22] Monthly revenue, min €/h, hour budget vs planned
 * @adr-ref: ADR-016
 */

import type { StaffOrgProductivityView } from '~/utils/staffOrg/productivity'

const props = defineProps<{
  openHours: number
  assignedHours: number
  laborCost: number
  headcount: number
  underMinCount: number
  overMaxCount: number
  productivity?: StaffOrgProductivityView | null
}>()

function formatEur(n: number): string {
  return Math.round(n).toLocaleString('nl-NL')
}

const impliedClass = computed(() => {
  const p = props.productivity
  if (!p || p.meetsMinProductivity == null) return 'text-gray-900'
  return p.meetsMinProductivity ? 'text-emerald-700' : 'text-red-600'
})

const gapClass = computed(() => {
  const g = props.productivity?.hoursOverBudget
  if (g == null) return 'text-gray-600'
  if (g > 0.5) return 'text-red-600'
  if (g < -0.5) return 'text-amber-700'
  return 'text-emerald-700'
})
</script>
