<!--
 @registry-id: productivityV3Page
 @created: 2026-04-28T20:40:00.000Z
 @last-modified: 2026-04-28T20:40:00.000Z
 @description: V3 productivity dashboard page - main entry for V3 working day dashboard
 @last-fix: [2026-04-28] Initial V3 productivity page
 @page-route: /daily-ops/productivity-v3

 Displays:
 - Total revenue, labor cost, productivity metrics
 - Location selector with all/per-location views
 - Hourly revenue and labor charts
 - Top products, teams, contracts
 - Team and contract breakdown tables
-->

<template>
  <div class="min-h-screen w-full min-w-0 flex-1 flex-col px-10 py-8 space-y-8">
    <!-- Header -->
    <div class="min-w-0">
      <h1 class="text-4xl font-bold text-gray-900">
        Productivity Dashboard
        <span class="text-lg font-normal text-gray-500">V3 (Working Day Snapshots)</span>
      </h1>
      <p class="mt-2 text-sm text-gray-600">
        Live business day metrics updated every 6 hours. Data updated: <span class="font-mono font-semibold">{{ formattedLastUpdate }}</span>
      </p>
    </div>

    <!-- Location Selector -->
    <div class="flex items-center gap-4">
      <label class="text-sm font-medium text-gray-700">Location:</label>
      <select
        v-model="selectedLocationId"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        @change="refreshData"
      >
        <option value="">All Locations</option>
        <option v-for="loc in locations" :key="loc._id" :value="loc._id">
          {{ loc.name }}
        </option>
      </select>
      <button
        @click="refreshData"
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
      >
        Refresh
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="flex items-center justify-center py-12">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
        <p class="mt-4 text-gray-600">Loading V3 snapshots...</p>
      </div>
    </div>

    <!-- Main Summary Cards -->
    <div v-else-if="currentSnapshot" class="grid grid-cols-1 gap-6 md:grid-cols-4">
      <!-- Total Revenue Card -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p class="text-sm font-medium text-gray-600">Total Revenue</p>
        <p class="mt-2 text-3xl font-bold text-gray-900">
          €{{ formatCurrency(currentSnapshot.cards.totalRevenue) }}
        </p>
        <p class="mt-2 text-xs text-gray-500">
          <span class="font-semibold text-green-600">{{ currentSnapshot.revenue.totalTransactions }}</span> transactions
        </p>
      </div>

      <!-- Labor Cost Card -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p class="text-sm font-medium text-gray-600">Labor Cost</p>
        <p class="mt-2 text-3xl font-bold text-gray-900">
          €{{ formatCurrency(currentSnapshot.cards.totalLaborCost) }}
        </p>
        <p class="mt-2 text-xs text-gray-500">
          <span class="font-semibold">{{ currentSnapshot.labor.totalWorkers }}</span> workers
        </p>
      </div>

      <!-- Revenue per Labor Hour Card -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p class="text-sm font-medium text-gray-600">Revenue/Hour</p>
        <p class="mt-2 text-3xl font-bold text-gray-900">
          €{{ formatCurrency(currentSnapshot.productivity.revenuePerLaborHour || 0) }}
        </p>
        <p class="mt-2 text-xs text-gray-500">per labor hour</p>
      </div>

      <!-- Labor Cost % Card -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p class="text-sm font-medium text-gray-600">Labor Cost %</p>
        <p class="mt-2 text-3xl font-bold text-gray-900">
          {{ formatPercent(currentSnapshot.productivity.laborCostPctOfRevenue || 0) }}%
        </p>
        <p class="mt-2 text-xs text-gray-500">of total revenue</p>
      </div>
    </div>

    <!-- Revenue Breakdown Grid -->
    <div v-if="currentSnapshot" class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Sales by Category -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Drinks</span>
            <span class="font-semibold text-gray-900">€{{ formatCurrency(currentSnapshot.revenue.drinksRevenue) }}</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-blue-600 h-2 rounded-full"
              :style="{ width: `${currentSnapshot.revenue.drinksRevenuePercent}%` }"
            ></div>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-sm text-gray-600">Food</span>
            <span class="font-semibold text-gray-900">€{{ formatCurrency(currentSnapshot.revenue.foodRevenue) }}</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-orange-600 h-2 rounded-full"
              :style="{ width: `${100 - currentSnapshot.revenue.drinksRevenuePercent}%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Labor Distribution -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Labor Distribution</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Total Hours</span>
            <span class="font-semibold text-gray-900">{{ currentSnapshot.labor.totalHours.toFixed(1) }}h</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Cost/Hour</span>
            <span class="font-semibold text-gray-900">€{{ formatCurrency(currentSnapshot.labor.costPerHour) }}</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-sm text-gray-600">Workers</span>
            <span class="font-semibold text-gray-900">{{ currentSnapshot.labor.totalWorkers }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Items -->
    <div v-if="currentSnapshot" class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Top Products -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Top Products</h3>
        <div v-if="currentSnapshot.topProducts.length > 0" class="space-y-2">
          <div v-for="(product, i) in currentSnapshot.topProducts.slice(0, 5)" :key="i" class="flex items-center justify-between border-b pb-2">
            <span class="text-sm text-gray-700">{{ product.name }}</span>
            <span class="text-sm font-semibold text-gray-900">€{{ formatCurrency(product.revenue) }}</span>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500">No data available</p>
      </div>

      <!-- Top Teams -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Top Teams</h3>
        <div v-if="currentSnapshot.topTeams.length > 0" class="space-y-2">
          <div v-for="(team, i) in currentSnapshot.topTeams.slice(0, 5)" :key="i" class="flex items-center justify-between border-b pb-2">
            <span class="text-sm text-gray-700">{{ team.teamName }}</span>
            <span class="text-sm font-semibold text-gray-900">{{ team.totalHours.toFixed(1) }}h</span>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500">No data available</p>
      </div>

      <!-- Top Contracts -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Contract Types</h3>
        <div v-if="currentSnapshot.topContracts.length > 0" class="space-y-2">
          <div v-for="(contract, i) in currentSnapshot.topContracts.slice(0, 5)" :key="i" class="flex items-center justify-between border-b pb-2">
            <span class="text-sm text-gray-700">{{ contract.contractType }}</span>
            <span class="text-sm font-semibold text-gray-900">{{ contract.workerCount }} workers</span>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500">No data available</p>
      </div>
    </div>

    <!-- Navigation to V3 Sub-pages -->
    <div class="mt-8 border-t pt-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">V3 Analytics Pages</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NuxtLink
          to="/daily-ops/sales-v3"
          class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
        >
          <h3 class="font-semibold text-gray-900">Sales Analytics V3</h3>
          <p class="text-sm text-gray-600 mt-1">Detailed revenue breakdown by day, hour, product, waiter</p>
        </NuxtLink>

        <NuxtLink
          to="/daily-ops/hours-v3"
          class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
        >
          <h3 class="font-semibold text-gray-900">Labor Analytics V3</h3>
          <p class="text-sm text-gray-600 mt-1">Detailed labor hours by day, hour, team, contract</p>
        </NuxtLink>

        <NuxtLink
          to="/daily-ops/workforce-v3"
          class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
        >
          <h3 class="font-semibold text-gray-900">Workforce V3</h3>
          <p class="text-sm text-gray-600 mt-1">Teams and contracts overview</p>
        </NuxtLink>
      </div>
    </div>

    <!-- Debug Info (for development) -->
    <div v-if="false" class="mt-12 rounded-lg bg-gray-100 p-4 text-xs font-mono text-gray-700">
      <p class="font-semibold mb-2">Debug: Snapshot Info</p>
      <p>Business Date: {{ currentSnapshot?.businessDate }}</p>
      <p>Last Updated: {{ currentSnapshot?.lastUpdatedAt }}</p>
      <p>Sync Count: {{ currentSnapshot?.syncCount }}</p>
      <p>Version: {{ currentSnapshot?.version }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { V3DailyOpsDashboardSnapshot } from '~/types/daily-ops-v3'

definePageMeta({
  keepalive: true,
})

// State
const pending = ref(true)
const locations = ref<any[]>([])
const selectedLocationId = ref('')
const currentSnapshot = ref<V3DailyOpsDashboardSnapshot | null>(null)
const lastRefreshTime = ref(new Date())

// Computed properties
const formattedLastUpdate = computed(() => {
  const date = currentSnapshot.value?.lastUpdatedAt
  if (!date) return 'N/A'
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(date))
})

// Formatters
const formatCurrency = (value: number): string => {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatPercent = (value: number): string => {
  return value.toFixed(1)
}

// Load locations
const loadLocations = async () => {
  try {
    const res = await $fetch('/api/locations')
    locations.value = res.data || []
  } catch (error) {
    console.error('[productivity-v3] Failed to load locations:', error)
  }
}

// Fetch dashboard data
const refreshData = async () => {
  pending.value = true
  try {
    let url = '/api/v3/dashboard'
    
    if (selectedLocationId.value) {
      url += `?locationId=${selectedLocationId.value}`
    } else {
      url += '?all=true'
    }

    const response = await $fetch(url)
    
    if (response.success) {
      if (Array.isArray(response.data)) {
        // Multiple locations - use first one for display
        currentSnapshot.value = response.data[0] || null
      } else {
        // Single location
        currentSnapshot.value = response.data
      }
    }

    lastRefreshTime.value = new Date()
  } catch (error) {
    console.error('[productivity-v3] Failed to fetch dashboard:', error)
  } finally {
    pending.value = false
  }
}

// Lifecycle
onMounted(async () => {
  await loadLocations()
  await refreshData()

  // Auto-refresh every 15 minutes
  setInterval(refreshData, 15 * 60 * 1000)
})
</script>
