<template>
  <StaffTotalsTab />
</template>

<script setup lang="ts">
/**
 * @registry-id: dailyOpsStaffTotalsPage
 * @created: 2026-06-25T12:00:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Staff totals charts — consumes staff-timeseries JSON via API
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: staff-timeseries (via GET /api/daily-ops/staff/timeseries)
 * @imports-data-from: composables/useDailyOpsStaffMetrics.ts
 */
import StaffTotalsTab from '~/components/daily-ops/staff/StaffTotalsTab.vue'
</script>
