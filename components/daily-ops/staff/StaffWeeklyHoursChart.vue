<template>
  <DailyOpsChartExpandShell
    title="Weekly hours vs contract"
    expand-aria-label="Expand weekly hours chart"
    modal-aria-label="Weekly hours chart expanded"
    :default-height="420"
  >
    <template #default="{ width, height, expanded }">
      <StaffWeeklyHoursChartPlot
        :weeks="weeks"
        :contract-weekly="contractWeekly"
        :container-width="width"
        :container-height="height"
        :expanded="expanded"
      />
    </template>
  </DailyOpsChartExpandShell>
</template>

<script setup lang="ts">
import DailyOpsChartExpandShell from '~/components/daily-ops/DailyOpsChartExpandShell.vue'
import StaffWeeklyHoursChartPlot from '~/components/daily-ops/staff/StaffWeeklyHoursChartPlot.vue'
import type { StaffWeeklyHoursWeek } from '~/types/daily-ops-staff'

defineProps<{
  weeks: StaffWeeklyHoursWeek[]
  contractWeekly: number | null
}>()
</script>
