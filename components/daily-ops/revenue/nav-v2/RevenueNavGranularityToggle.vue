<template>
  <div
    class="inline-flex items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-1"
    role="group"
    aria-label="Granularity"
  >
    <button
      v-for="opt in OPTIONS"
      :key="opt.id"
      type="button"
      class="shrink-0 rounded px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      :class="active === opt.id
        ? 'bg-gray-900 text-white'
        : 'text-gray-700 hover:bg-gray-100'"
      @click="$emit('select', opt.id)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { RevenueNavV2Granularity } from '~/types/daily-ops-revenue-nav-v2'

defineProps<{ active: RevenueNavV2Granularity }>()
defineEmits<{ select: [g: RevenueNavV2Granularity] }>()

const OPTIONS: { id: RevenueNavV2Granularity; label: string }[] = [
  { id: 'day',   label: 'Day' },
  { id: 'week',  label: 'Week' },
  { id: 'month', label: 'Month' },
]
</script>
