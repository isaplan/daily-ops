<template>
  <nav
    aria-label="Chart view"
    class="inline-flex shrink-0 flex-nowrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-1"
  >
    <button
      type="button"
      class="shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      :class="mode === 'chart'
        ? 'bg-gray-900 text-white'
        : 'text-gray-700 hover:bg-gray-100'"
      @click="emit('update:mode', 'chart')"
    >
      Grafiek
    </button>
    <button
      type="button"
      class="shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      :class="mode === 'table'
        ? 'bg-gray-900 text-white'
        : 'text-gray-700 hover:bg-gray-100'"
      @click="emit('update:mode', 'table')"
    >
      Tabel
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { RevenueViewMode } from '~/composables/useDailyOpsRevenueViewMode'

defineProps<{ mode: RevenueViewMode }>()
const emit = defineEmits<{ 'update:mode': [RevenueViewMode] }>()
</script>
