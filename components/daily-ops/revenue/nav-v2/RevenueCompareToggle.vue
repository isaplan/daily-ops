<template>
  <div class="flex items-center gap-2">
    <button
      type="button"
      class="shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      :class="compareMode
        ? 'bg-indigo-600 text-white'
        : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50'"
      @click="$emit('toggle')"
    >
      {{ compareMode ? 'Comparing' : 'Compare' }}
    </button>

    <span
      v-if="compareMode && compareSlots.length"
      class="text-xs text-gray-500"
    >
      {{ compareSlots.length }} selected (max 4)
    </span>

    <button
      v-if="compareMode"
      type="button"
      class="text-xs text-gray-500 underline hover:text-gray-700"
      @click="$emit('clear')"
    >
      Clear
    </button>
  </div>
</template>

<script setup lang="ts">
import type { RevenueNavV2Slot } from '~/types/daily-ops-revenue-nav-v2'

defineProps<{
  compareMode: boolean
  compareSlots: RevenueNavV2Slot[]
}>()

defineEmits<{
  toggle: []
  clear: []
}>()
</script>
