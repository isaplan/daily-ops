<template>
  <StaffPlusminTab />
</template>

<script setup lang="ts">
/**
 * @registry-id: dailyOpsStaffPlusminPage
 * @created: 2026-06-25T14:00:00.000Z
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Staff plus/min tab — consumes staff-plusmin JSON via API
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: staff-plusmin (via GET /api/daily-ops/staff/plusmin-summary)
 * @imports-data-from: composables/useDailyOpsStaffPlusmin.ts
 */
import StaffPlusminTab from '~/components/daily-ops/staff/StaffPlusminTab.vue'

definePageMeta({ keepalive: true })
</script>
