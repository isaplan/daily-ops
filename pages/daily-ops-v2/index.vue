<template>
  <DailyOpsHomeDashboard page-heading-suffix="Productivity V2" metrics-api-path="/api/daily-ops-v2/metrics/bundle" />
</template>

<script setup lang="ts">
definePageMeta({
  keepalive: true,
})
</script>
