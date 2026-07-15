<template>
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Weekly Report</h1>
      <p class="text-sm text-gray-600">
        {{ doc.locationName }} · {{ doc.digest.label }} · {{ formatDateWithMonth(doc.digest.startDate) }} → {{ formatDateWithMonth(doc.digest.endDate) }}
      </p>
      <p v-if="isFrozen" class="mt-1 text-xs font-medium text-gray-500">
        Frozen — computed fields no longer auto-update. Comments and todos remain editable.
      </p>
    </div>
    <div class="flex gap-2">
      <UButton variant="outline" size="sm" @click="$emit('print')">
        Print PDF
      </UButton>
      <NuxtLink
        :to="`/daily-ops/analytics/weekly-report?week=${doc.weekKey}&location=${doc.locationId}`"
        class="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Daily Ops view
      </NuxtLink>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { WeeklyReportDocument } from '~/types/weeklyReportDocument'

defineProps<{
  doc: WeeklyReportDocument
  isFrozen: boolean
}>()

defineEmits<{ print: [] }>()

function formatDateWithMonth(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>
