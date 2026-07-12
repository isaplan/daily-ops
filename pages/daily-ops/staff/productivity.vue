<template>
  <DailyOpsProductivityRevenuePage />
</template>

<script setup lang="ts">
/**
 * @registry-id: dailyOpsStaffProductivityPage
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Staff productivity view — dashboard-bundle labor slice
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: dashboard-bundle (via GET /api/daily-ops/metrics/bundle)
 * @imports-data-from: composables/useDailyOpsDashboardMetrics.ts (via DailyOpsHomeDashboard)
 */
definePageMeta({ keepalive: true })
</script>
