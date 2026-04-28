<!--
 @registry-id: salesV2Page
 @created: 2026-04-29T00:50:00.000Z
 @last-modified: 2026-04-29T00:50:00.000Z
 @description: V2 revenue sales by-worker breakdown page
 @page-route: /daily-ops-v2/sales/by-worker
-->

<template>
  <div class="min-h-screen w-full min-w-0 flex-1 flex-col px-10 py-8 space-y-8">
    <div class="min-w-0">
      <h1 class="text-4xl font-bold text-gray-900">Daily Ops V2 / Sales / uy worker</h1>
      <p class="mt-2 text-sm text-gray-600">Revenue breakdown (V2 Aggregation)</p>
    </div>

    <div class="rounded-lg bg-amber-50 border border-amber-200 p-6">
      <h3 class="font-semibold text-amber-900">Page Coming Soon</h3>
      <p class="text-sm text-amber-800 mt-2">This page will show detailed revenue analysis.</p>
    </div>

    <NuxtLink to="/daily-ops-v2/sales" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
      ← Back to Sales Overview
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  keepalive: true,
})
</script>
