<template>
  <DailyOpsDashboardShell>
    <div class="space-y-8">
      <header class="space-y-2">
        <h1 class="text-[38px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
          Daily Ops / {{ locationTitle }} / Dashboard
        </h1>
        <p class="text-xl font-medium text-gray-700">
          {{ contextHeadline }}
        </p>
        <p v-if="data?.vatDisclaimer" class="text-base italic text-gray-500">
          {{ data.vatDisclaimer }}
        </p>
      </header>

      <UAlert v-if="error" color="error" variant="soft" title="Could not load overview" :description="String(error)" />

      <UCard v-else class="border border-blue-100 bg-blue-50/80">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-base font-semibold text-gray-900">
              🔍 GraphQL Pipeline Debug
            </h2>
            <UIcon name="i-lucide-chevron-down" class="size-4 text-gray-500" />
          </div>
        </template>
        <p class="text-sm text-gray-600">
          Pipeline status will appear here when the GraphQL layer is connected.
        </p>
      </UCard>

      <div v-if="pending" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <USkeleton v-for="i in 4" :key="i" class="h-28 w-full rounded-lg" />
      </div>

      <div v-else-if="data" class="space-y-8">
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <UCard class="border-2 border-gray-900 bg-white">
            <p class="text-sm font-medium text-gray-500">Total Revenue</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ formatEur(data.summary.totalRevenue) }}</p>
          </UCard>
          <UCard class="border-2 border-gray-900 bg-white">
            <p class="text-sm font-medium text-gray-500">Total Labor Cost</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ formatEur(data.summary.totalLaborCost) }}</p>
          </UCard>
          <UCard class="border-2 border-gray-900 bg-white">
            <p class="text-sm font-medium text-gray-500">Profit</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ formatEur(data.summary.profit) }}</p>
          </UCard>
          <UCard class="border-2 border-gray-900 bg-white">
            <p class="text-sm font-medium text-gray-500">Profit Margin</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ data.summary.profitMarginPct.toFixed(1) }}%</p>
          </UCard>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold text-gray-900">Revenue by Category</h2>
            </template>
            <ul class="divide-y divide-gray-100">
              <li
                v-for="row in data.revenueByCategory"
                :key="row.key"
                class="flex items-center justify-between py-3 text-sm"
              >
                <span class="font-medium text-gray-700">{{ row.label }}</span>
                <span class="tabular-nums text-gray-900">{{ formatEur(row.amount) }}</span>
              </li>
            </ul>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold text-gray-900">Revenue by Time Period</h2>
            </template>
            <ul class="divide-y divide-gray-100">
              <li
                v-for="row in data.revenueByTimePeriod"
                :key="row.key"
                class="flex items-center justify-between py-3 text-sm"
              >
                <span class="font-medium text-gray-700">{{ row.label }}</span>
                <span class="tabular-nums text-gray-900">{{ formatEur(row.amount) }}</span>
              </li>
            </ul>
          </UCard>
        </div>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900">Most Profitable Hour</h2>
          </template>
          <div class="grid gap-4 sm:grid-cols-4">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Hour</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ data.mostProfitableHour.hourLabel }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Revenue</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(data.mostProfitableHour.revenue) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Labor Cost</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(data.mostProfitableHour.laborCost) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Profit</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(data.mostProfitableHour.profit) }}</p>
            </div>
          </div>
        </UCard>

        <p class="text-xs text-gray-400">
          Range: {{ data.range.startDate }} → {{ data.range.endDate }} ({{ data.range.period }})
        </p>
      </div>
    </div>
  </DailyOpsDashboardShell>
</template>

<script setup lang="ts">
import type { DailyOpsOverviewDto } from '~/types/daily-ops-dashboard'

type LocationRow = { _id: string; name: string }

const { dashboardQuery, contextHeadline, locationId } = useDailyOpsDashboardRoute()
const { formatEur } = useDashboardEurFormat()

const { data: locationsRes } = await useFetch<{ success: boolean; data: LocationRow[] }>('/api/locations')

const locationTitle = computed(() => {
  if (!locationId.value) return 'All Locations'
  const rows = locationsRes.value?.data ?? []
  const hit = rows.find((row) => row._id === locationId.value)
  return hit?.name ?? 'Selected Location'
})

const { data, pending, error } = await useFetch<DailyOpsOverviewDto>('/api/daily-ops/overview', {
  query: dashboardQuery,
})
</script>
