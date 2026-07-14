<template>
  <nav
    aria-label="Weekly report period"
    class="scrollbar-hide inline-flex w-max max-w-full min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-md border-2 border-gray-900 bg-white p-1"
  >
    <button
      type="button"
      class="rounded px-3 py-1.5 text-sm font-semibold transition-colors"
      :class="isThisWeek ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
      @click="goToThisWeek"
    >
      This week
    </button>
    <button
      type="button"
      class="rounded px-3 py-1.5 text-sm font-semibold transition-colors"
      :class="isLastWeek ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
      @click="goToLastWeek"
    >
      Last week
    </button>
    <button
      type="button"
      class="rounded px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
      @click="shiftWeek(-1)"
    >
      ← Prev
    </button>
    <button
      type="button"
      class="rounded px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
      @click="shiftWeek(1)"
    >
      Next →
    </button>
    <select
      :value="targetsPreset"
      class="rounded border-0 bg-transparent px-3 py-1.5 text-sm font-semibold text-gray-700 focus:outline-none"
      @change="onTargetsChange"
    >
      <option value="standard">Targets: Standard</option>
      <option value="strict">Targets: Strict</option>
      <option value="relaxed">Targets: Relaxed</option>
    </select>
    <NuxtLink
      v-if="fullReportLink"
      :to="fullReportLink"
      class="rounded px-3 py-1.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
    >
      See full report →
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import type { WeeklyTargetPresetId } from '~/types/daily-ops-weekly-report'

const {
  targetsPreset,
  setTargetsPreset,
  shiftWeek,
  goToThisWeek,
  goToLastWeek,
  isThisWeek,
  isLastWeek,
  week,
  locationId,
} = useDailyOpsWeeklyReport()

const fullReportLink = computed(() => {
  const w = week.value
  if (!w) return null
  const loc = locationId.value
  if (!loc || loc === 'all') return `/weekly-reports/${w}`
  return `/weekly-reports/${w}?location=${loc}`
})

function onTargetsChange(e: Event) {
  setTargetsPreset((e.target as HTMLSelectElement).value as WeeklyTargetPresetId)
}
</script>
