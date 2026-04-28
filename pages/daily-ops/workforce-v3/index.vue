<!--
 @registry-id: workforceV3IndexPage
 @created: 2026-04-28T21:00:00.000Z
 @last-modified: 2026-04-28T21:00:00.000Z
 @description: V3 workforce overview page - teams and contracts summary
 @last-fix: [2026-04-28] Initial V3 workforce index page
 @page-route: /daily-ops/workforce-v3
-->

<template>
  <div class="min-h-screen w-full min-w-0 flex-1 flex-col px-10 py-8 space-y-8">
    <!-- Header -->
    <div class="min-w-0">
      <h1 class="text-4xl font-bold text-gray-900">
        Workforce V3
        <span class="text-lg font-normal text-gray-500">Teams & Contracts</span>
      </h1>
      <p class="mt-2 text-sm text-gray-600">
        Overview of teams and contract types for today's working day
      </p>
    </div>

    <!-- Navigation -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NuxtLink
        to="/daily-ops/workforce-v3/teams-v3"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">Teams</h3>
        <p class="text-sm text-gray-600 mt-1">Team details and hours</p>
      </NuxtLink>

      <NuxtLink
        to="/daily-ops/workforce-v3/contracts-v3"
        class="rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:shadow-md transition"
      >
        <h3 class="font-semibold text-gray-900">Contracts</h3>
        <p class="text-sm text-gray-600 mt-1">Contract types and workforce distribution</p>
      </NuxtLink>
    </div>

    <!-- Teams Summary -->
    <div v-if="currentSnapshot && currentSnapshot.teams.length > 0" class="rounded-lg border border-gray-200 bg-white p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Active Teams</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b">
              <th class="text-left py-2 px-4 font-semibold text-gray-700">Team</th>
              <th class="text-right py-2 px-4 font-semibold text-gray-700">Workers</th>
              <th class="text-right py-2 px-4 font-semibold text-gray-700">Hours</th>
              <th class="text-right py-2 px-4 font-semibold text-gray-700">Cost</th>
              <th class="text-right py-2 px-4 font-semibold text-gray-700">% Hours</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="team in currentSnapshot.teams" :key="team.teamId" class="border-b hover:bg-gray-50">
              <td class="py-2 px-4 text-gray-900 font-medium">{{ team.teamName }}</td>
              <td class="text-right py-2 px-4 text-gray-700">{{ team.workerCount }}</td>
              <td class="text-right py-2 px-4 text-gray-700">{{ team.totalHours.toFixed(1) }}h</td>
              <td class="text-right py-2 px-4 text-gray-700">€{{ formatCurrency(team.totalCost) }}</td>
              <td class="text-right py-2 px-4">
                <div class="flex items-center justify-end gap-2">
                  <div class="w-12 bg-gray-200 rounded h-2">
                    <div class="bg-blue-600 h-2 rounded" :style="{ width: `${Math.min(100, team.pctOfTotalHours)}%` }"></div>
                  </div>
                  <span class="text-gray-700 w-12 text-right">{{ team.pctOfTotalHours.toFixed(1) }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Contracts Summary -->
    <div v-if="currentSnapshot && currentSnapshot.contracts.length > 0" class="rounded-lg border border-gray-200 bg-white p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Contract Distribution</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b">
              <th class="text-left py-2 px-4 font-semibold text-gray-700">Contract Type</th>
              <th class="text-right py-2 px-4 font-semibold text-gray-700">Workers</th>
              <th class="text-right py-2 px-4 font-semibold text-gray-700">Hours</th>
              <th class="text-right py-2 px-4 font-semibold text-gray-700">Cost</th>
              <th class="text-right py-2 px-4 font-semibold text-gray-700">% Hours</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="contract in currentSnapshot.contracts" :key="contract.contractType" class="border-b hover:bg-gray-50">
              <td class="py-2 px-4 text-gray-900 font-medium">{{ contract.contractType }}</td>
              <td class="text-right py-2 px-4 text-gray-700">{{ contract.workerCount }}</td>
              <td class="text-right py-2 px-4 text-gray-700">{{ contract.totalHours.toFixed(1) }}h</td>
              <td class="text-right py-2 px-4 text-gray-700">€{{ formatCurrency(contract.totalCost) }}</td>
              <td class="text-right py-2 px-4">
                <div class="flex items-center justify-end gap-2">
                  <div class="w-12 bg-gray-200 rounded h-2">
                    <div class="bg-orange-600 h-2 rounded" :style="{ width: `${Math.min(100, contract.pctOfTotalHours)}%` }"></div>
                  </div>
                  <span class="text-gray-700 w-12 text-right">{{ contract.pctOfTotalHours.toFixed(1) }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Coming Soon Notice -->
    <div class="rounded-lg bg-blue-50 border border-blue-200 p-6">
      <h3 class="font-semibold text-blue-900">Detailed Pages Coming Soon</h3>
      <p class="text-sm text-blue-800 mt-2">
        Detailed team and contract pages with worker lists and historical trends.
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
    console.error('[workforce-v3] Failed to load data:', error)
  }
}

onMounted(() => {
  loadData()
})
</script>
