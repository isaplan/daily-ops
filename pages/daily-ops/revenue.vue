<template>
  <DailyOpsRevenuePage />
</template>

<script setup lang="ts">
/**
 * @registry-id: dailyOpsRevenuePage
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Revenue analytics shell
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: revenue-summary, revenue-timeseries, revenue-* (via GET /api/daily-ops/revenue/*)
 * @imports-data-from: composables/useDailyOpsRevenueMetrics.ts (via RevenuePage)
 */
definePageMeta({
  keepalive: false,
})
</script>
