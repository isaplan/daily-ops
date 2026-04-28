<!--
 @registry-id: hoursV3IndexPage
 @created: 2026-04-28T20:55:00.000Z
 @last-modified: 2026-04-28T21:15:00.000Z
 @description: V3 labor analytics overview page - main entry for hours/labor V3 section
 @last-fix: [2026-04-28] Moved to /daily-ops-v3/hours structure
 @page-route: /daily-ops-v3/hours
-->

<template>
  <div class="min-h-screen w-full min-w-0 flex-1 flex-col px-10 py-8 space-y-8">
    <!-- Header -->
    <div class="min-w-0">
      <h1 class="text-4xl font-bold text-gray-900">
        Daily Ops V3 / Hours
        <span class="text-lg font-normal text-gray-500">Working Day Breakdown</span>
      </h1>
      <p class="mt-2 text-sm text-gray-600">
        Detailed labor hours analysis by day, hour, team, and contract (V3 Aggregation)
      </p>
    </div>

    <!-- Navigation -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <NuxtLink
        to="/daily-ops-v3/hours/by-day"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">By Day</h3>
        <p class="text-sm text-gray-600 mt-1">Daily labor breakdown</p>
      </NuxtLink>

      <NuxtLink
        to="/daily-ops-v3/hours/by-hour"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">By Hour</h3>
        <p class="text-sm text-gray-600 mt-1">Hourly labor breakdown</p>
      </NuxtLink>

      <NuxtLink
        to="/daily-ops-v3/hours/by-team"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">By Team</h3>
        <p class="text-sm text-gray-600 mt-1">Team hours analysis</p>
      </NuxtLink>

      <NuxtLink
        to="/daily-ops-v3/hours/by-contract"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">By Contract</h3>
        <p class="text-sm text-gray-600 mt-1">Contract type breakdown</p>
      </NuxtLink>
    </div>

    <!-- Quick Stats -->
    <div v-if="currentSnapshot" class="rounded-lg border border-gray-200 bg-white p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Today's Labor Summary</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p class="text-sm text-gray-600">Total Hours</p>
          <p class="text-2xl font-bold text-gray-900">{{ currentSnapshot.totalHours.toFixed(1) }}h</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Total Cost</p>
          <p class="text-2xl font-bold text-gray-900">€{{ formatCurrency(currentSnapshot.totalCost) }}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Workers</p>
          <p class="text-2xl font-bold text-gray-900">{{ currentSnapshot.totalWorkers }}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Cost/Hour</p>
          <p class="text-2xl font-bold text-gray-900">€{{ formatCurrency(currentSnapshot.costPerHour) }}</p>
        </div>
      </div>
    </div>

    <!-- Teams Overview -->
    <div v-if="currentSnapshot && currentSnapshot.teams.length > 0" class="rounded-lg border border-gray-200 bg-white p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Teams</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b">
              <th class="text-left py-2 px-4 font-semibold text-gray-700">Team</th>
              <th class="text-right py-2 px-4 font-semibold text-gray-700">Workers</th>
              <th class="text-right py-2 px-4 font-semibold text-gray-700">Hours</th>
              <th class="text-right py-2 px-4 font-semibold text-gray-700">Cost</th>
              <th class="text-right py-2 px-4 font-semibold text-gray-700">% of Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="team in currentSnapshot.teams.slice(0, 10)" :key="team.teamId" class="border-b hover:bg-gray-50">
              <td class="py-2 px-4 text-gray-900">{{ team.teamName }}</td>
              <td class="text-right py-2 px-4 text-gray-700">{{ team.workerCount }}</td>
              <td class="text-right py-2 px-4 text-gray-700">{{ team.totalHours.toFixed(1) }}h</td>
              <td class="text-right py-2 px-4 text-gray-700">€{{ formatCurrency(team.totalCost) }}</td>
              <td class="text-right py-2 px-4 text-gray-700">{{ team.pctOfTotalHours.toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Back Button -->
    <NuxtLink to="/daily-ops-v3" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
      ← Back to V3 Dashboard
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { V3LaborWorkingDaySnapshot } from '~/types/daily-ops-v3'

definePageMeta({
  keepalive: true,
})

const currentSnapshot = ref<V3LaborWorkingDaySnapshot | null>(null)

const formatCurrency = (value: number): string => {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const loadData = async () => {
  try {
    const response = await $fetch('/api/v3/labor?all=true')
    if (response.success && Array.isArray(response.data)) {
      currentSnapshot.value = response.data[0] || null
    }
  } catch (error) {
    console.error('[hours-v3] Failed to load data:', error)
  }
}

onMounted(() => {
  loadData()
})
</script>
