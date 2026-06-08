<template>
  <nav
    aria-label="Revenue mode"
    class="scrollbar-hide inline-flex w-max max-w-full min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-md border-2 border-gray-900 bg-white p-1"
  >
    <button
      v-for="m in REVENUE_NAV_V2_MODE_CONFIGS"
      :key="m.id"
      type="button"
      class="shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      :class="activeMode === m.id
        ? 'bg-gray-900 text-white'
        : 'text-gray-700 hover:bg-gray-100'"
      @click="$emit('select', m.id)"
    >
      {{ m.label }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { RevenueNavV2Mode } from '~/types/daily-ops-revenue-nav-v2'
import { REVENUE_NAV_V2_MODE_CONFIGS } from '~/utils/dailyOpsRevenueNavV2/modes'

defineProps<{ activeMode: RevenueNavV2Mode }>()
defineEmits<{ select: [mode: RevenueNavV2Mode] }>()
</script>
