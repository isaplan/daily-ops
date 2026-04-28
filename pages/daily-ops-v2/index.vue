<template>
  <DailyOpsHomeDashboard page-heading-suffix="Dashboard V2" metrics-api-path="/api/daily-ops-v2/metrics/bundle" />
</template>

<script setup lang="ts">
definePageMeta({
  keepalive: true,
})
</script>
