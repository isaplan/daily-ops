<template>
  <div class="flex w-full min-w-0 flex-col items-end gap-2">
    <!-- Mode tabs (primary bar) -->
    <div class="flex w-full min-w-0 justify-end">
      <DailyOpsRevenueNavV2RevenueNavModeTabs
        :active-mode="query.mode"
        @select="setMode"
      />
    </div>

    <!-- Day-picker for daily mode -->
    <div
      v-if="query.mode === 'daily'"
      class="flex w-full min-w-0 items-center justify-end gap-2"
    >
      <label class="text-xs font-medium text-gray-500" for="rev-nav-v2-datepick">Pick date</label>
      <input
        id="rev-nav-v2-datepick"
        type="date"
        class="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        :value="query.pick ?? ''"
        :max="todayIso"
        @change="onDatePick"
      />
      <button
        v-if="query.pick"
        type="button"
        class="text-xs text-gray-400 hover:text-gray-600"
        @click="setPick(null)"
      >
        ✕
      </button>
    </div>

    <!-- Child slots (secondary bar) -->
    <div class="flex w-full min-w-0 items-center gap-2">
      <DailyOpsRevenueNavV2RevenueCompareToggle
        class="shrink-0"
        :compare-mode="query.compare"
        :compare-slots="query.compareSlots"
        @toggle="toggleCompare()"
        @clear="onClearCompare"
      />

      <div class="flex min-w-0 flex-1 justify-end overflow-hidden">
        <DailyOpsRevenueNavV2RevenueNavChildBar
          :active-mode="query.mode"
          :active-slot="query.slot"
          :compare-mode="query.compare"
          :compare-slots="query.compareSlots"
          @select="onChildSelect"
        />
      </div>
    </div>

    <!-- Granularity toggle — shown for modes where bucketing matters -->
    <div
      v-if="showGranularity"
      class="flex w-full min-w-0 items-center justify-end gap-2"
    >
      <span class="text-xs font-medium text-gray-500">Group by</span>
      <DailyOpsRevenueNavV2RevenueNavGranularityToggle
        :active="query.granularity"
        @select="setGranularity"
      />
    </div>

    <!-- Venue bar -->
    <div class="flex w-full min-w-0 justify-end">
      <DailyOpsRevenueNavV2RevenueNavVenueBar
        :active-location="query.location"
        @select="setLocation"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RevenueNavV2Mode, RevenueNavV2Slot } from '~/types/daily-ops-revenue-nav-v2'

const {
  query,
  setMode,
  setSlot,
  toggleCompare,
  setCompareSlots,
  setLocation,
  setGranularity,
  setPick,
} = useDailyOpsRevenueNavV2()

const todayIso = new Date().toISOString().slice(0, 10)

function onDatePick(e: Event) {
  const v = (e.target as HTMLInputElement).value
  setPick(v || null)
}

/** Show bucket toggle for multi-day modes where granularity changes the chart meaningfully. */
const GRANULARITY_MODES = new Set<RevenueNavV2Mode>(['weekly', 'monthly', 'quarterly', 'yearly', 'seasonal', 'period'])
const showGranularity = computed(() => GRANULARITY_MODES.has(query.value.mode))

function onChildSelect(slot: RevenueNavV2Slot) {
  if (!query.value.compare) {
    setSlot(slot)
    return
  }
  // Compare multi-select — max 4
  const current = [...query.value.compareSlots]
  const idx = current.indexOf(slot)
  if (idx === -1) {
    if (current.length < 4) current.push(slot)
  } else {
    current.splice(idx, 1)
  }
  setCompareSlots(current)
}

function onClearCompare() {
  toggleCompare(false)
}
</script>
