<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Sales by Day (V3 - Correct Business Day)</h1>
      <p class="text-gray-500">View sales data per day with correct business day logic (06:00-05:59 UTC)</p>
    </div>

    <UCard v-if="error" class="border-red-200">
      <p class="text-red-600"><strong>Error:</strong> {{ error }}</p>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
        <p class="text-sm text-gray-500">Filter and sort sales data</p>
      </template>
      <div class="grid gap-4 md:grid-cols-3">
        <div class="space-y-2">
          <label class="text-sm font-medium">Start Date</label>
          <UInput v-model="filters.startDate" type="date" @update:model-value="() => fetchSales(true)" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">End Date</label>
          <UInput v-model="filters.endDate" type="date" @update:model-value="() => fetchSales(true)" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Location</label>
          <USelectMenu
            v-model="filters.locationId"
            :items="locationOptions"
            value-attribute="value"
            class="w-full"
            @update:model-value="() => fetchSales(true)"
          />
        </div>
      </div>
      <div class="mt-4 flex items-center gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Sort Order</label>
          <USelectMenu
            v-model="filters.sortOrder"
            :items="[{ label: 'Descending', value: 'desc' }, { label: 'Ascending', value: 'asc' }]"
            value-attribute="value"
            class="w-36"
            @update:model-value="() => fetchSales(true)"
          />
        </div>
        <UButton variant="outline" class="mt-6" @click="resetFilters">Reset Filters</UButton>
      </div>
    </UCard>

    <div v-if="salesData.length > 0" class="grid gap-4 md:grid-cols-3">
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Total Revenue</span>
        </template>
        <p class="text-2xl font-bold">€{{ totalRevenue.toFixed(2) }}</p>
      </UCard>
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Average Daily Revenue</span>
        </template>
        <p class="text-2xl font-bold">€{{ averageDailyRevenue.toFixed(2) }}</p>
      </UCard>
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Total Days</span>
        </template>
        <p class="text-2xl font-bold">{{ salesData.length }}</p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Sales by Day (V3)</h2>
        <p class="text-sm text-gray-500">
          {{ loading ? 'Loading...' : `${salesData.length} day(s) with data` }}
        </p>
      </template>
      <div v-if="loading" class="py-8 text-center text-gray-500">Loading sales data...</div>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Business Date</th>
                <th class="pb-2 pr-4 font-medium">Revenue</th>
                <th class="pb-2 pr-4 font-medium">Quantity</th>
                <th class="pb-2 pr-4 font-medium">Transactions</th>
                <th class="pb-2 font-medium">Part 1 / Part 2</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in salesData" :key="i" class="border-b transition-colors hover:bg-gray-50">
                <td class="py-2 pr-4 font-mono">{{ row.businessDate }}</td>
                <td class="py-2 pr-4">€{{ row.totalRevenue != null ? Number(row.totalRevenue).toFixed(2) : '0.00' }}</td>
                <td class="py-2 pr-4">{{ row.totalQuantity != null ? Number(row.totalQuantity).toFixed(0) : '0' }}</td>
                <td class="py-2 pr-4">{{ row.transactionCount ?? 0 }}</td>
                <td class="py-2 pr-4 text-xs text-gray-600">
                  Part1: €{{ Number(row.part1Revenue ?? 0).toFixed(0) }} / Part2: €{{ Number(row.part2Revenue ?? 0).toFixed(0) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="salesData.length === 0 && !loading" class="mt-4 text-center text-sm text-gray-500">
          Sales data is aggregated from the Bork API (V3 - correct business day logic).
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'

const { startDate: defaultStart, endDate: defaultEnd } = getLast30DaysRange()

const filters = reactive({
  startDate: defaultStart,
  endDate: defaultEnd,
  locationId: 'all',
  sortOrder: 'desc',
})

const salesData = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const locations = ref<{ _id: string; name: string }[]>([])

const locationOptions = computed(() => [
  { label: 'All Locations', value: 'all' },
  ...locations.value.map((l) => ({ label: l.name, value: l._id })),
])

const totalRevenue = computed(() => {
  return salesData.value.reduce((sum, row) => sum + (Number(row.totalRevenue) || 0), 0)
})

const averageDailyRevenue = computed(() => {
  if (salesData.value.length === 0) return 0
  return totalRevenue.value / salesData.value.length
})

async function fetchSales(resetPage = false) {
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams({
      startDate: filters.startDate,
      endDate: filters.endDate,
      locationId: filters.locationId,
      sortOrder: filters.sortOrder,
    })

    const response = await $fetch<{
      success: boolean
      data?: Record<string, unknown>[]
      locations?: { _id: string; name: string }[]
    }>(`/api/v3/sales-by-day?${params}`)

    if (response.success) {
      salesData.value = response.data ?? []
      locations.value = response.locations ?? []
    } else {
      error.value = 'Failed to load sales data'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error loading sales data'
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  const r = getLast30DaysRange()
  filters.startDate = r.startDate
  filters.endDate = r.endDate
  filters.locationId = 'all'
  filters.sortOrder = 'desc'
  void fetchSales(true)
}

onMounted(() => {
  void fetchSales(true)
})
</script>
