<script setup lang="ts">
import type { DailyOpsLaborDayDto } from '~/types/daily-ops-dashboard'
import { getDayHoursShareParts } from '~/utils/dailyOpsHoursShare'

const props = withDefaults(
  defineProps<{
    day: DailyOpsLaborDayDto
    amount: number
    /** Force em dash (e.g. missing row or empty location rollup) */
    showDash?: boolean
    /** When false, show hours only (hide share-of-day %). */
    showShareOfDay?: boolean
    hoursClass?: string
    pctClass?: string
  }>(),
  {
    showDash: false,
    showShareOfDay: true,
    hoursClass: '',
    pctClass: 'tabular-nums text-[10px] font-normal text-gray-600',
  }
)

const parts = computed(() => {
  if (props.showDash) return { hours: '—', pct: null as string | null }
  return getDayHoursShareParts(props.amount, props.day)
})

const hoursSpanClass = computed(() =>
  props.hoursClass || 'tabular-nums font-medium'
)
</script>

<template>
  <span
    v-if="!parts.pct"
    :class="hoursSpanClass"
  >{{ parts.hours }}</span>
  <span
    v-else-if="!showShareOfDay"
    :class="hoursSpanClass"
  >{{ parts.hours }}</span>
  <span
    v-else
    class="inline-flex items-baseline justify-center gap-x-1 leading-tight"
  >
    <span :class="hoursSpanClass">{{ parts.hours }}</span>
    <span :class="pctClass">{{ parts.pct }}</span>
  </span>
</template>
