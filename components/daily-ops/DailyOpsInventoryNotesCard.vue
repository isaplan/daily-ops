<template>
  <UCard v-if="(inventory?.notes?.length ?? 0) > 0" class="border-2 border-amber-800 bg-amber-50/90">
    <template #header>
      <h2 class="text-lg font-semibold text-gray-900">Data Coverage &amp; Method Notes</h2>
    </template>
    <ul class="list-inside list-disc space-y-1 text-sm text-gray-700">
      <li v-for="(note, i) in inventory?.notes ?? []" :key="i">{{ note }}</li>
    </ul>
    <p class="mt-3 text-xs text-gray-500">
      Flags: bork_business_days (V2) {{ inventory?.hasBorkCronData ? 'yes' : 'no' }}, bork_sales_by_hour (V2)
      {{ inventory?.hasBorkHourData ? 'yes' : 'no' }}, eitje_time_registration_aggregation
      {{ inventory?.hasEitjeAggData ? 'yes' : 'no' }}.
    </p>
  </UCard>
</template>

<script setup lang="ts">
import type { DailyOpsLaborMetricsDto } from '~/types/daily-ops-dashboard'

defineProps<{
  inventory?: DailyOpsLaborMetricsDto['inventory'] | null
}>()
</script>
