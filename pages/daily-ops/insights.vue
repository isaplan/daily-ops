<template>
  <DailyOpsPerformanceInsights />
</template>

<script setup lang="ts">
/**
 * @registry-id: dailyOpsInsightsPage
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Performance insights page
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: insights (via GET /api/daily-ops/insights)
 * @imports-data-from: composables/useDailyOpsInsightsMetrics.ts (via DailyOpsPerformanceInsights)
 */
import DailyOpsPerformanceInsights from '~/components/daily-ops/insights/DailyOpsPerformanceInsights.vue'

definePageMeta({ keepalive: true })
</script>
