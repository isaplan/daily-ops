<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Sales by Table</h1>
      <p class="text-gray-500">Table-level sales aggregation from Bork API</p>
    </div>

    <UCard v-if="error" class="border-red-200">
      <p class="text-red-600"><strong>Error:</strong> {{ error }}</p>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
      </template>
      <div class="grid gap-4 md:grid-cols-3">
        <div class="space-y-2">
          <label class="text-sm font-medium">Start Date</label>
          <UInput v-model="filters.startDate" type="date" @update:model-value="() => fetchData(true)" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">End Date</label>
          <UInput v-model="filters.endDate" type="date" @update:model-value="() => fetchData(true)" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Location</label>
          <USelectMenu
            v-model="filters.locationId"
            :items="locationOptions"
            value-attribute="value"
            class="w-full"
            @update:model-value="() => fetchData(true)"
          />
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        <UButton variant="outline" @click="resetFilters">Reset</UButton>
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
        <p class="text-2xl font-bold">{{ totalQuantity.toFixed(0) }}</p>
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
        <h2 class="font-semibold">
          Sales Data ({{ paginationTotal }} total · showing {{ data.length }} on this page)
        </h2>
      </template>
      <div v-if="loading" class="py-8 text-center text-gray-500">Loading...</div>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="w-8 pb-2 pr-4"></th>
                <th class="pb-2 pr-4 font-medium">Date</th>
                <th class="pb-2 pr-4 font-medium">Table</th>
                <th class="pb-2 pr-4 font-medium">Location</th>
                <th class="pb-2 pr-4 font-medium">Revenue</th>
                <th class="pb-2 pr-4 font-medium">Quantity</th>
              </tr>
            </thead>
            <tbody
              v-for="(row, i) in data"
              :key="`by-table-${String(row.date)}-${row.hour}-${String(row.locationId)}-${String(row.tableNumber)}-${i}`"
            >
              <tr class="border-b transition-colors hover:bg-gray-50 cursor-pointer" @click="toggleExpanded(i)">
                <td class="py-2 pr-4 text-center">
                  <UIcon :name="expandedRows.includes(i) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4" />
                </td>
                <td class="py-2 pr-4">{{ formatDate(row.date) }}</td>
                <td class="py-2 pr-4">{{ row.tableNumber || 'Unknown' }}</td>
                <td class="py-2 pr-4">{{ row.locationName || 'Unknown' }}</td>
                <td class="py-2 pr-4">€{{ Number(row.total_revenue ?? 0).toFixed(2) }}</td>
                <td class="py-2 pr-4">{{ Number(row.total_quantity ?? 0).toFixed(0) }}</td>
              </tr>
              <tr v-if="expandedRows.includes(i)" class="border-b bg-gray-50">
                <td colspan="6" class="py-4 px-4">
                  <div class="ml-4 space-y-4">
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div
                        v-for="(value, key) in Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'products'))"
                        :key="key"
                        class="space-y-1"
                      >
                        <span class="font-semibold text-gray-700 text-xs uppercase tracking-tight">{{ key }}</span>
                        <span class="text-gray-900 block font-mono text-xs">{{ value }}</span>
                      </div>
                    </div>
                    <div class="pt-3 border-t border-gray-200">
                      <h4 class="font-semibold text-gray-700 text-sm mb-3">
                        Sales Breakdown for Hour {{ String(row.hour).padStart(2, '0') }}:00
                      </h4>
                      <p v-if="detailByKey[rowKey('table', row)]?.loading" class="text-sm text-gray-500">Loading products…</p>
                      <p v-else-if="detailByKey[rowKey('table', row)]?.error" class="text-sm text-red-600">
                        {{ detailByKey[rowKey('table', row)]?.error }}
                      </p>
                      <div v-else-if="(detailByKey[rowKey('table', row)]?.items ?? []).length > 0" class="space-y-3">
                        <div class="bg-white p-3 rounded border border-gray-200">
                          <div class="grid grid-cols-3 gap-4 text-xs font-semibold text-gray-600 mb-2 pb-2 border-b">
                            <div>Product</div>
                            <div class="text-right">Revenue</div>
                            <div class="text-right">Qty</div>
                          </div>
                          <div
                            v-for="(prod, idx) in detailByKey[rowKey('table', row)]?.items ?? []"
                            :key="idx"
                            class="grid grid-cols-3 gap-4 text-xs py-1"
                          >
                            <div class="font-semibold text-gray-900">{{ prod.productName }}</div>
                            <div class="text-right text-gray-600">€{{ Number(prod.revenue).toFixed(2) }}</div>
                            <div class="text-right text-gray-600">{{ prod.quantity }}</div>
                          </div>
                        </div>
                      </div>
                      <p v-else class="text-sm text-gray-500">No product lines for this row.</p>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="paginationTotal > pageSize" class="mt-6 flex justify-center">
          <UPagination
            :page="page"
            :total="paginationTotal"
            :items-per-page="pageSize"
            @update:page="onPageChange"
          />
        </div>
        <p v-if="data.length === 0 && !loading" class="mt-4 text-center text-sm text-gray-500">
          No data found. Run sync to populate.
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'

const { startDate: defaultStart, endDate: defaultEnd } = getLast30DaysRange()
const { detailByKey, rowKey, ensureProducts, resetDetails } = useSalesRowProducts()

const filters = reactive({
  startDate: defaultStart,
  endDate: defaultEnd,
  locationId: 'all',
})

const data = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const locations = ref<{ _id: string; name: string }[]>([])
const expandedRows = ref<number[]>([])
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

const fetchData = async (resetPage = false) => {
  if (resetPage) page.value = 1
  loading.value = true
  error.value = null
  expandedRows.value = []
  resetDetails()
  try {
    const params = new URLSearchParams({
      startDate: filters.startDate,
      endDate: filters.endDate,
      locationId: filters.locationId,
      groupBy: 'table',
      page: String(page.value),
      pageSize: String(pageSize),
    })
    const response = await $fetch<{
      success: boolean
      data?: Record<string, unknown>[]
      locations?: { _id: string; name: string }[]
      pagination?: { totalCount: number }
      totals?: { total_revenue: number; total_quantity: number; record_count: number }
    }>(`/api/sales-aggregated?${params}`)
    if (response.success) {
      data.value = response.data ?? []
      locations.value = response.locations ?? []
      paginationTotal.value = response.pagination?.totalCount ?? data.value.length
      rangeTotals.value = {
        total_revenue: response.totals?.total_revenue ?? 0,
        total_quantity: response.totals?.total_quantity ?? 0,
        record_count: response.totals?.record_count ?? 0,
      }
    } else {
      error.value = 'Failed to load data'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error loading data'
  } finally {
    loading.value = false
  }
}

const onPageChange = (p: number) => {
  page.value = p
  void fetchData(false)
}

const resetFilters = () => {
  const r = getLast30DaysRange()
  filters.startDate = r.startDate
  filters.endDate = r.endDate
  filters.locationId = 'all'
  void fetchData(true)
}

const formatDate = (date: unknown): string => {
  if (!date) return ''
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const toggleExpanded = (index: number) => {
  const idx = expandedRows.value.indexOf(index)
  if (idx > -1) {
    expandedRows.value.splice(idx, 1)
  } else {
    expandedRows.value.push(index)
    const row = data.value[index]
    if (row) void ensureProducts('table', row)
  }
}

onMounted(() => {
  void fetchData(true)
})
</script>
