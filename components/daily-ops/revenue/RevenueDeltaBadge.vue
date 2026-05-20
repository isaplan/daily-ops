<template>
  <p class="mt-1 text-xs" :class="delta.pct != null && delta.pct < 0 ? 'text-red-600' : 'text-green-700'">
    {{ delta.amount >= 0 ? '+' : '' }}{{ formatEur(delta.amount) }}
    <span v-if="delta.pct != null"> ({{ delta.pct >= 0 ? '+' : '' }}{{ delta.pct }}%)</span>
  </p>
</template>

<script setup lang="ts">
defineProps<{
  delta: { amount: number; pct: number | null }
}>()
const { formatEur } = useDashboardEurFormat()
</script>
