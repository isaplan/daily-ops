<template>
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Monthly Report</h1>
      <p class="text-sm text-gray-600">
        {{ doc.locationName }} · {{ doc.digest.label }} · {{ formatDateWithMonth(doc.digest.startDate) }} → {{ formatDateWithMonth(doc.digest.endDate) }}
      </p>
      <p v-if="isLocked" class="mt-1 text-xs font-medium text-gray-500">
        Locked — computed fields no longer auto-update. Comments and todos remain editable.
      </p>
    </div>
    <div class="flex gap-2">
      <UButton variant="outline" size="sm" @click="$emit('print')">
        Print PDF
      </UButton>
      <UButton
        v-if="isLocked"
        variant="outline"
        size="sm"
        :loading="lockPending"
        @click="$emit('unlock')"
      >
        Unlock
      </UButton>
      <UButton
        v-else
        size="sm"
        :loading="lockPending"
        @click="$emit('save-lock')"
      >
        Save
      </UButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { MonthlyReportDocument } from '~/types/monthlyReportDocument'

defineProps<{
  doc: MonthlyReportDocument
  isLocked: boolean
  lockPending?: boolean
}>()

defineEmits<{ print: []; unlock: []; 'save-lock': [] }>()

function formatDateWithMonth(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>
