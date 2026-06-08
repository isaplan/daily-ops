<template>
  <div class="flex w-full min-w-0 flex-col items-end gap-2">
    <!-- Mode tabs (primary bar) -->
    <div class="flex w-full min-w-0 justify-end">
      <DailyOpsRevenueNavV2RevenueNavModeTabs
        :active-mode="query.mode"
        @select="setMode"
      />
    </div>

    <!-- Child slots (secondary bar) -->
    <div class="flex w-full min-w-0 items-center justify-between gap-2">
      <DailyOpsRevenueNavV2RevenueCompareToggle
        :compare-mode="query.compare"
        :compare-slots="query.compareSlots"
        @toggle="toggleCompare()"
        @clear="onClearCompare"
      />

      <DailyOpsRevenueNavV2RevenueNavChildBar
        :active-mode="query.mode"
        :active-slot="query.slot"
        :compare-mode="query.compare"
        :compare-slots="query.compareSlots"
        @select="onChildSelect"
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

const { query, setMode, setSlot, toggleCompare, setCompareSlots, setLocation } = useDailyOpsRevenueNavV2()

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
