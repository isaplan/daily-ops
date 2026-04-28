<!--
 @registry-id: salesV3IndexPage
 @created: 2026-04-28T20:50:00.000Z
 @last-modified: 2026-04-28T20:50:00.000Z
 @description: V3 sales analytics overview page - main entry for sales V3 section
 @last-fix: [2026-04-28] Initial V3 sales index page
 @page-route: /daily-ops/sales-v3
-->

<template>
  <div class="min-h-screen w-full min-w-0 flex-1 flex-col px-10 py-8 space-y-8">
    <!-- Header -->
    <div class="min-w-0">
      <h1 class="text-4xl font-bold text-gray-900">
        Sales Analytics V3
        <span class="text-lg font-normal text-gray-500">Working Day Breakdown</span>
      </h1>
      <p class="mt-2 text-sm text-gray-600">
        Detailed revenue analysis by day, hour, product, and waiter
      </p>
    </div>

    <!-- Navigation -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <NuxtLink
        to="/daily-ops/sales-v3/by-day-v3"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">By Day</h3>
        <p class="text-sm text-gray-600 mt-1">Daily revenue breakdown</p>
      </NuxtLink>

      <NuxtLink
        to="/daily-ops/sales-v3/by-hour-v3"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">By Hour</h3>
        <p class="text-sm text-gray-600 mt-1">Hourly revenue breakdown</p>
      </NuxtLink>

      <NuxtLink
        to="/daily-ops/sales-v3/by-product-v3"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">By Product</h3>
        <p class="text-sm text-gray-600 mt-1">Product-level analysis</p>
      </NuxtLink>

      <NuxtLink
        to="/daily-ops/sales-v3/by-waiter-v3"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">By Waiter</h3>
        <p class="text-sm text-gray-600 mt-1">Waiter performance</p>
      </NuxtLink>
    </div>

    <!-- Quick Stats -->
    <div v-if="currentSnapshot" class="rounded-lg border border-gray-200 bg-white p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p class="text-sm text-gray-600">Total Revenue</p>
          <p class="text-2xl font-bold text-gray-900">€{{ formatCurrency(currentSnapshot.totalRevenue) }}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Transactions</p>
          <p class="text-2xl font-bold text-gray-900">{{ currentSnapshot.totalTransactions }}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Avg. Transaction</p>
          <p class="text-2xl font-bold text-gray-900">€{{ formatCurrency(currentSnapshot.avgRevenuePerTransaction) }}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Drinks %</p>
          <p class="text-2xl font-bold text-gray-900">{{ currentSnapshot.drinksRevenuePercent.toFixed(1) }}%</p>
        </div>
      </div>
    </div>

    <!-- Coming Soon Notice -->
    <div class="rounded-lg bg-blue-50 border border-blue-200 p-6">
      <h3 class="font-semibold text-blue-900">Detailed Pages Coming Soon</h3>
      <p class="text-sm text-blue-800 mt-2">
        These pages will provide deep dives into sales analytics with charts, tables, and filtering options.
      </p>
    </div>

    <!-- Back Button -->
    <NuxtLink to="/daily-ops/productivity-v3" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
      ← Back to Dashboard
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { V3SalesWorkingDaySnapshot } from '~/types/daily-ops-v3'

definePageMeta({
  keepalive: true,
})

const currentSnapshot = ref<V3SalesWorkingDaySnapshot | null>(null)

const formatCurrency = (value: number): string => {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const loadData = async () => {
  try {
    const response = await $fetch('/api/v3/sales?all=true')
    if (response.success && Array.isArray(response.data)) {
      currentSnapshot.value = response.data[0] || null
    }
  } catch (error) {
    console.error('[sales-v3] Failed to load data:', error)
  }
}

onMounted(() => {
  loadData()
})
</script>
