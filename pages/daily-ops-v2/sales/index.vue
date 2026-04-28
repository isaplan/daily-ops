<!--
 @registry-id: salesV2IndexPage
 @created: 2026-04-28T21:20:00.000Z
 @last-modified: 2026-04-28T21:20:00.000Z
 @description: V2 sales analytics overview page - main entry for sales V2 section
 @last-fix: [2026-04-28] Created V2 sales structure at /daily-ops-v2/sales
 @page-route: /daily-ops-v2/sales
-->

<template>
  <div class="min-h-screen w-full min-w-0 flex-1 flex-col px-10 py-8 space-y-8">
    <!-- Header -->
    <div class="min-w-0">
      <h1 class="text-4xl font-bold text-gray-900">
        Daily Ops V2 / Sales
        <span class="text-lg font-normal text-gray-500">Day Breakdown</span>
      </h1>
      <p class="mt-2 text-sm text-gray-600">
        Detailed revenue analysis by day, hour, product, and waiter (V2 Aggregation)
      </p>
    </div>

    <!-- Navigation -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <NuxtLink
        to="/daily-ops-v2/sales/by-day"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">By Day</h3>
        <p class="text-sm text-gray-600 mt-1">Daily revenue breakdown</p>
      </NuxtLink>

      <NuxtLink
        to="/daily-ops-v2/sales/by-hour"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">By Hour</h3>
        <p class="text-sm text-gray-600 mt-1">Hourly revenue breakdown</p>
      </NuxtLink>

      <NuxtLink
        to="/daily-ops-v2/sales/by-product"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">By Product</h3>
        <p class="text-sm text-gray-600 mt-1">Product-level analysis</p>
      </NuxtLink>

      <NuxtLink
        to="/daily-ops-v2/sales/by-worker"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">By Worker</h3>
        <p class="text-sm text-gray-600 mt-1">Worker performance</p>
      </NuxtLink>
    </div>

    <!-- Coming Soon Notice -->
    <div class="rounded-lg bg-amber-50 border border-amber-200 p-6">
      <h3 class="font-semibold text-amber-900">V2 Sales Pages Coming Soon</h3>
      <p class="text-sm text-amber-800 mt-2">
        Detailed V2 sales analytics pages will be available soon with comprehensive breakdowns by day, hour, product, and worker.
      </p>
    </div>

    <!-- Back Button -->
    <NuxtLink to="/daily-ops-v2" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
      ← Back to V2 Dashboard
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  keepalive: true,
})
</script>
