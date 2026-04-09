<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Sales Overview</h1>
      <p class="text-gray-500">View sales data per day per location</p>
    </div>

    <UCard v-if="error" class="border-red-200">
      <p class="text-red-600"><strong>Error:</strong> {{ error }}</p>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
        <p class="text-sm text-gray-500">Filter and sort sales data</p>
      </template>
      <div class="grid gap-4 md:grid-cols-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Start Date</label>
          <UInput v-model="filters.startDate" type="date" @update:model-value="fetchSales" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">End Date</label>
          <UInput v-model="filters.endDate" type="date" @update:model-value="fetchSales" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Location</label>
          <USelectMenu
            v-model="filters.locationId"
            :items="locationOptions"
            value-attribute="value"
            class="w-full"
            @update:model-value="fetchSales"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Group By</label>
          <USelectMenu
            v-model="filters.groupBy"
            :items="groupByOptions"
            value-attribute="value"
            class="w-full"
            @update:model-value="fetchSales"
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
            @update:model-value="fetchSales"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Order</label>
          <USelectMenu
            v-model="filters.sortOrder"
            :items="[{ label: 'Descending', value: 'desc' }, { label: 'Ascending', value: 'asc' }]"
            value-attribute="value"
            class="w-36"
            @update:model-value="fetchSales"
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
        <h2 class="font-semibold">Sales Data</h2>
        <p class="text-sm text-gray-500">
          {{ loading ? 'Loading...' : `${salesData.length} record(s) found` }}
        </p>
      </template>
      <div v-if="loading" class="py-8 text-center text-gray-500">Loading sales data...</div>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th v-if="filters.groupBy === 'date'" class="pb-2 pr-4 font-medium">Date</th>
                <th v-if="filters.groupBy === 'date'" class="pb-2 pr-4 font-medium">Revenue</th>
                <th v-if="filters.groupBy === 'date'" class="pb-2 pr-4 font-medium">Quantity</th>
                <th v-if="filters.groupBy === 'date'" class="pb-2 pr-4 font-medium">Records</th>
                <th v-if="filters.groupBy === 'date'" class="pb-2 pr-4 font-medium">Locations</th>

                <th v-if="filters.groupBy === 'location'" class="pb-2 pr-4 font-medium">Location</th>
                <th v-if="filters.groupBy === 'location'" class="pb-2 pr-4 font-medium">Revenue</th>
                <th v-if="filters.groupBy === 'location'" class="pb-2 pr-4 font-medium">Quantity</th>
                <th v-if="filters.groupBy === 'location'" class="pb-2 pr-4 font-medium">Records</th>
                <th v-if="filters.groupBy === 'location'" class="pb-2 pr-4 font-medium">Products</th>

                <th v-if="filters.groupBy === 'product'" class="pb-2 pr-4 font-medium">Product</th>
                <th v-if="filters.groupBy === 'product'" class="pb-2 pr-4 font-medium">Revenue</th>
                <th v-if="filters.groupBy === 'product'" class="pb-2 pr-4 font-medium">Quantity</th>
                <th v-if="filters.groupBy === 'product'" class="pb-2 pr-4 font-medium">Records</th>
                <th v-if="filters.groupBy === 'product'" class="pb-2 pr-4 font-medium">Locations</th>

                <th v-if="filters.groupBy === 'date_location'" class="pb-2 pr-4 font-medium">Date</th>
                <th v-if="filters.groupBy === 'date_location'" class="pb-2 pr-4 font-medium">Location</th>
                <th v-if="filters.groupBy === 'date_location'" class="pb-2 pr-4 font-medium">Revenue</th>
                <th v-if="filters.groupBy === 'date_location'" class="pb-2 pr-4 font-medium">Quantity</th>
                <th v-if="filters.groupBy === 'date_location'" class="pb-2 pr-4 font-medium">Records</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in salesData" :key="i" class="border-b transition-colors hover:bg-gray-50">
                <td v-if="filters.groupBy === 'date'" class="py-2 pr-4">{{ formatDate(row.date) }}</td>
                <td v-if="filters.groupBy === 'date'" class="py-2 pr-4">€{{ row.total_revenue != null ? Number(row.total_revenue).toFixed(2) : '0.00' }}</td>
                <td v-if="filters.groupBy === 'date'" class="py-2 pr-4">{{ row.total_quantity != null ? Number(row.total_quantity).toFixed(2) : '0.00' }}</td>
                <td v-if="filters.groupBy === 'date'" class="py-2 pr-4">{{ row.record_count ?? 0 }}</td>
                <td v-if="filters.groupBy === 'date'" class="py-2 pr-4">{{ row.location_count ?? 0 }}</td>

                <td v-if="filters.groupBy === 'location'" class="py-2 pr-4">{{ row.location_name || 'Unknown' }}</td>
                <td v-if="filters.groupBy === 'location'" class="py-2 pr-4">€{{ row.total_revenue != null ? Number(row.total_revenue).toFixed(2) : '0.00' }}</td>
                <td v-if="filters.groupBy === 'location'" class="py-2 pr-4">{{ row.total_quantity != null ? Number(row.total_quantity).toFixed(2) : '0.00' }}</td>
                <td v-if="filters.groupBy === 'location'" class="py-2 pr-4">{{ row.record_count ?? 0 }}</td>
                <td v-if="filters.groupBy === 'location'" class="py-2 pr-4">{{ row.product_count ?? 0 }}</td>

                <td v-if="filters.groupBy === 'product'" class="py-2 pr-4">{{ row.product_name || 'Unknown' }}</td>
                <td v-if="filters.groupBy === 'product'" class="py-2 pr-4">€{{ row.total_revenue != null ? Number(row.total_revenue).toFixed(2) : '0.00' }}</td>
                <td v-if="filters.groupBy === 'product'" class="py-2 pr-4">{{ row.total_quantity != null ? Number(row.total_quantity).toFixed(2) : '0.00' }}</td>
                <td v-if="filters.groupBy === 'product'" class="py-2 pr-4">{{ row.record_count ?? 0 }}</td>
                <td v-if="filters.groupBy === 'product'" class="py-2 pr-4">{{ row.location_count ?? 0 }}</td>

                <td v-if="filters.groupBy === 'date_location'" class="py-2 pr-4">{{ formatDate(row.date) }}</td>
                <td v-if="filters.groupBy === 'date_location'" class="py-2 pr-4">{{ row.location_name || 'Unknown' }}</td>
                <td v-if="filters.groupBy === 'date_location'" class="py-2 pr-4">€{{ row.total_revenue != null ? Number(row.total_revenue).toFixed(2) : '0.00' }}</td>
                <td v-if="filters.groupBy === 'date_location'" class="py-2 pr-4">{{ row.total_quantity != null ? Number(row.total_quantity).toFixed(2) : '0.00' }}</td>
                <td v-if="filters.groupBy === 'date_location'" class="py-2 pr-4">{{ row.record_count ?? 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="salesData.length === 0 && !loading" class="mt-4 text-center text-sm text-gray-500">
          Sales data is synced from the Bork API. Configure Settings → Bork API and run sync to populate.
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'

const groupByOptions = [
  { label: 'By Date', value: 'date' },
  { label: 'By Location', value: 'location' },
  { label: 'By Product', value: 'product' },
  { label: 'By Date & Location', value: 'date_location' },
]

const sortByOptions = [
  { label: 'Date', value: 'date' },
  { label: 'Location', value: 'location_name' },
  { label: 'Product', value: 'product_name' },
  { label: 'Revenue', value: 'total_revenue' },
  { label: 'Quantity', value: 'total_quantity' },
]

const today = new Date()
const defaultStart = '2025-01-01'
const defaultEnd = today.toISOString().split('T')[0]

const filters = reactive({
  startDate: defaultStart,
  endDate: defaultEnd,
  locationId: 'all',
  groupBy: 'date',
  sortBy: 'date',
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
  return salesData.value.reduce((sum, row) => sum + Number(row.total_revenue ?? 0), 0)
})

const totalQuantity = computed(() => {
  return salesData.value.reduce((sum, row) => sum + Number(row.total_quantity ?? 0), 0)
})

const totalRecords = computed(() => {
  return salesData.value.reduce((sum, row) => sum + (Number(row.record_count ?? 0)), 0)
})

const fetchSales = async () => {
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams({
      startDate: filters.startDate,
      endDate: filters.endDate,
      locationId: filters.locationId,
      groupBy: filters.groupBy,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    })
    const response = await $fetch<{ success: boolean; data?: Record<string, unknown>[]; locations?: Record<string, unknown>[]; summary?: Record<string, unknown> }>(`/api/sales-aggregated?${params}`)
    if (response.success) {
      salesData.value = response.data ?? []
      locations.value = (response.locations as { _id: string; name: string }[]) ?? []
    } else {
      error.value = 'Failed to load sales data'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error loading sales data'
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.startDate = defaultStart
  filters.endDate = defaultEnd
  filters.locationId = 'all'
  filters.groupBy = 'date'
  filters.sortBy = 'date'
  filters.sortOrder = 'desc'
  fetchSales()
}

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

onMounted(() => {
  fetchSales()
})
</script>
