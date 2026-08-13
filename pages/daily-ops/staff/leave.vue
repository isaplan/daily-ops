<template>
  <StaffLeaveCalendarTab />
</template>

<script setup lang="ts">
/**
 * @registry-id: dailyOpsStaffLeavePage
 * @created: 2026-08-13T14:13:52.000Z
 * @last-modified: 2026-08-13T14:37:54.000Z
 * @description: Staff leave calendar tab — year Gantt vacations / leave / sick
 * @last-fix: [2026-08-13] Year Gantt leave page
 * @adr-ref: ADR-004
 * @data-source: direct-db
 * @read-cache-json: none
 * @imports-data-from: composables/useDailyOpsStaffLeaveCalendar.ts
 */
import StaffLeaveCalendarTab from '~/components/daily-ops/staff/StaffLeaveCalendarTab.vue'

definePageMeta({ keepalive: false })
</script>
