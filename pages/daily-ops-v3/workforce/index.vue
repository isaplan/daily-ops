<!--
 @registry-id: workforceV3IndexPage
 @created: 2026-04-28T21:25:00.000Z
 @last-modified: 2026-04-28T21:25:00.000Z
 @description: V3 workforce overview page - teams and contracts summary
 @last-fix: [2026-04-28] Created V3 workforce structure at /daily-ops-v3/workforce
 @page-route: /daily-ops-v3/workforce
-->

<template>
  <div class="min-h-screen w-full min-w-0 flex-1 flex-col px-10 py-8 space-y-8">
    <!-- Header -->
    <div class="min-w-0">
      <h1 class="text-4xl font-bold text-gray-900">
        Daily Ops V3 / Workforce
        <span class="text-lg font-normal text-gray-500">Teams & Contracts Overview</span>
      </h1>
      <p class="mt-2 text-sm text-gray-600">
        Summary of workforce teams and contract types (V3 Aggregation)
      </p>
    </div>

    <!-- Back Button -->
    <NuxtLink to="/daily-ops-v3" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
      ← Back to V3 Dashboard
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  keepalive: true,
})
</script>
