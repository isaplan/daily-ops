<script setup lang="ts">
/**
 * @registry-id: dailyOpsHoursByWorker
 * @last-modified: 2026-07-02T00:00:00.000Z
 * @description: Hours by worker
 * @last-fix: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-013
 * @data-source: direct-db
 * @read-cache-json: none
 * @imports-data-from: GET /api/hours/*
 */
await navigateTo('/workers', { replace: true })
</script>

<template>
  <div />
</template>
