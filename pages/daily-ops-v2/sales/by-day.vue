<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Sales by Day (V2 - Filtered)</h1>
      <p class="text-gray-500">View sales data per day (V2 aggregation - excludes unsettled transactions)</p>
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
          <label class="text-sm font-medium">Sort By</label>
          <USelectMenu
            v-model="filters.sortBy"
            :items="sortByOptions"
            value-attribute="value"
            class="w-36"
            @update:model-value="() => fetchSales(true)"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Order</label>
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

    <div v-if="paginationTotal > 0" class="grid gap-4 md:grid-cols-3">
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Total Revenue</span>
        </template>
        <p class="text-2xl font-bold">€{{ totalRevenue.toFixed(2) }}</p>
      </UCard>
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Total Quantity</span>
        </template>
        <p class="text-2xl font-bold">{{ totalQuantity.toFixed(2) }}</p>
      </UCard>
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Total Records</span>
        </template>
        <p class="text-2xl font-bold">{{ totalRecords }}</p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Sales by Day (V2)</h2>
        <p class="text-sm text-gray-500">
          {{ loading ? 'Loading...' : `${paginationTotal} day(s) total · ${salesData.length} on this page` }}
        </p>
      </template>
      <div v-if="loading" class="py-8 text-center text-gray-500">Loading sales data...</div>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Date</th>
                <th class="pb-2 pr-4 font-medium">Revenue</th>
                <th class="pb-2 pr-4 font-medium">Quantity</th>
                <th class="pb-2 pr-4 font-medium">Records</th>
                <th class="pb-2 pr-4 font-medium">Locations</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in salesData" :key="i" class="border-b transition-colors hover:bg-gray-50">
                <td class="py-2 pr-4">{{ formatDate(row.date) }}</td>
                <td class="py-2 pr-4">€{{ row.total_revenue != null ? Number(row.total_revenue).toFixed(2) : '0.00' }}</td>
                <td class="py-2 pr-4">{{ row.total_quantity != null ? Number(row.total_quantity).toFixed(2) : '0.00' }}</td>
                <td class="py-2 pr-4">{{ row.record_count ?? 0 }}</td>
                <td class="py-2 pr-4">{{ row.location_count ?? 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="paginationTotal > pageSize" class="mt-6 flex justify-center">
          <UPagination :page="page" :total="paginationTotal" :items-per-page="pageSize" @update:page="onPageChange" />
        </div>
        <p v-if="salesData.length === 0 && !loading" class="mt-4 text-center text-sm text-gray-500">
          Sales data is synced from the Bork API (V2 - filtered aggregation).
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'

const sortByOptions = [
  { label: 'Date', value: 'date' },
  { label: 'Revenue', value: 'total_revenue' },
  { label: 'Quantity', value: 'total_quantity' },
]

const { startDate: defaultStart, endDate: defaultEnd } = getLast30DaysRange()

const filters = reactive({
  startDate: defaultStart,
  endDate: defaultEnd,
  locationId: 'all',
  sortBy: 'date',
  sortOrder: 'desc',
})

const salesData = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const locations = ref<{ _id: string; name: string }[]>([])
const page = ref(1)
const pageSize = 50
const paginationTotal = ref(0)
const rangeTotals = ref({ total_revenue: 0, total_quantity: 0, record_count: 0 })

const locationOptions = computed(() => [
  { label: 'All Locations', value: 'all' },
  ...locations.value.map((l) => ({ label: l.name, value: l._id })),
])

const totalRevenue = computed(() => rangeTotals.value.total_revenue)
const totalQuantity = computed(() => rangeTotals.value.total_quantity)
const totalRecords = computed(() => Math.round(rangeTotals.value.record_count))

async function fetchSales(resetPage = false) {
  if (resetPage) page.value = 1
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams({
      startDate: filters.startDate,
      endDate: filters.endDate,
      locationId: filters.locationId,
      groupBy: 'date',
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      page: String(page.value),
      pageSize: String(pageSize),
    })
    const response = await $fetch<{
      success: boolean
      data?: Record<string, unknown>[]
      locations?: { _id: string; name: string }[]
      pagination?: { totalCount: number }
      totals?: { total_revenue: number; total_quantity: number; record_count: number }
    }>(`/api/sales-aggregated-v2?${params}`)
    if (response.success) {
      salesData.value = response.data ?? []
      locations.value = response.locations ?? []
      paginationTotal.value = response.pagination?.totalCount ?? salesData.value.length
      rangeTotals.value = {
        total_revenue: response.totals?.total_revenue ?? 0,
        total_quantity: response.totals?.total_quantity ?? 0,
        record_count: response.totals?.record_count ?? 0,
      }
    } else {
      error.value = 'Failed to load sales data'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error loading sales data'
  } finally {
    loading.value = false
  }
}

function onPageChange(p: number) {
  page.value = p
  void fetchSales(false)
}

function resetFilters() {
  const r = getLast30DaysRange()
  filters.startDate = r.startDate
  filters.endDate = r.endDate
  filters.locationId = 'all'
  filters.sortBy = 'date'
  filters.sortOrder = 'desc'
  void fetchSales(true)
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

onMounted(() => {
  void fetchSales(true)
})
</script>
