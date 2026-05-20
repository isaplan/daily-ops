<template>
  <div class="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 text-xs">
    <button
      type="button"
      class="rounded px-2 py-1 font-medium"
      :class="mode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'"
      @click="emit('update:mode', 'table')"
    >
      Tabel
    </button>
    <button
      type="button"
      class="rounded px-2 py-1 font-medium"
      :class="mode === 'chart' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'"
      @click="emit('update:mode', 'chart')"
    >
      Grafiek
    </button>
  </div>
</template>

<script setup lang="ts">
import type { RevenueViewMode } from '~/composables/useDailyOpsRevenueViewMode'

defineProps<{ mode: RevenueViewMode }>()
const emit = defineEmits<{ 'update:mode': [RevenueViewMode] }>()
</script>
