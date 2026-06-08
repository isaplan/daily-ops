<template>
  <nav
    aria-label="Revenue venue"
    class="scrollbar-hide inline-flex w-max max-w-full min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-md border-2 border-gray-900 bg-white p-1"
  >
    <button
      v-for="loc in REVENUE_LOCATIONS"
      :key="loc.abbrev"
      type="button"
      class="shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      :class="(activeLocation ?? null) === loc.id
        ? 'bg-gray-900 text-white'
        : 'text-gray-700 hover:bg-gray-100'"
      @click="$emit('select', loc.id)"
    >
      <span class="md:hidden">{{ loc.abbrev }}</span>
      <span class="hidden md:inline">{{ loc.abbrev === 'All' ? 'All' : loc.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { REVENUE_LOCATIONS } from '~/utils/dailyOpsRevenueAnalyticsNav'

defineProps<{ activeLocation: string | null }>()
defineEmits<{ select: [locationId: string | null] }>()
</script>
