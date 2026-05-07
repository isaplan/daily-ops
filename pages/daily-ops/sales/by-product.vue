<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Sales by Product</h1>
      <p class="text-gray-500">
        From V2 <code class="text-xs">bork_sales_by_product</code> rollups (same Bork line math as the rebuild pipeline): each row is product × unit price; same product at different prices stays separate. Range uses
        <strong>business dates</strong>. Totals are Σ Price×Qty — no menu layer.
      </p>
    </div>

    <UCard v-if="error" class="border-red-200">
      <p class="text-red-600"><strong>Error:</strong> {{ error }}</p>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
      </template>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div class="space-y-2">
          <label class="text-sm font-medium">Start date</label>
          <UInput v-model="filters.startDate" type="date" @update:model-value="() => fetchData(true)" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">End date</label>
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
        <div class="space-y-2">
          <label class="text-sm font-medium">Search product</label>
          <UInput v-model="filters.search" placeholder="Filter products..." @update:model-value="() => fetchData(true)" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Min line total (period)</label>
          <UInput v-model.number="filters.minRevenue" type="number" placeholder="0.00" @update:model-value="() => fetchData(true)" />
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        <UButton variant="outline" @click="resetFilters">Reset</UButton>
      </div>
    </UCard>

    <div v-if="paginationTotal > 0" class="grid gap-4 md:grid-cols-3">
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Total line value (matched)</span>
        </template>
        <p class="text-2xl font-bold">€{{ totalRevenue.toFixed(2) }}</p>
      </UCard>
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Total quantity (matched)</span>
        </template>
        <p class="text-2xl font-bold">{{ totalQuantity.toFixed(0) }}</p>
      </UCard>
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Rows (product × unit price)</span>
        </template>
        <p class="text-2xl font-bold">{{ paginationTotal }}</p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Lines ({{ paginationTotal }} total · showing {{ data.length }} on this page)
        </h2>
      </template>
      <div v-if="loading" class="py-8 text-center text-gray-500">Loading...</div>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="w-8 pb-2 pr-4"></th>
                <th class="pb-2 pr-4 font-medium">Product</th>
                <th class="pb-2 pr-4 font-medium">Product ID</th>
                <th class="pb-2 pr-4 font-medium">Unit price (Bork)</th>
                <th class="pb-2 pr-4 font-medium">Line total (Σ Price×Qty)</th>
                <th class="pb-2 pr-4 font-medium">Qty</th>
                <th class="pb-2 pr-4 font-medium">Locations</th>
              </tr>
            </thead>
            <tbody
              v-for="(row, i) in data"
              :key="`by-product-${String(row.productId ?? '')}-${String(row.unit_price ?? '')}-${i}`"
            >
              <tr class="border-b transition-colors hover:bg-gray-50 cursor-pointer" @click="toggleExpanded(i)">
                <td class="py-2 pr-4 text-center">
                  <UIcon :name="expandedRows.includes(i) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4" />
                </td>
                <td class="py-2 pr-4">{{ row.productName || 'Unknown' }}</td>
                <td class="py-2 pr-4 text-xs font-mono text-gray-600">{{ row.productId }}</td>
                <td class="py-2 pr-4 font-mono">€{{ euro(row.unit_price) }}</td>
                <td class="py-2 pr-4 font-mono">€{{ euro(row.total_revenue) }}</td>
                <td class="py-2 pr-4">{{ Number(row.total_quantity ?? 0).toFixed(0) }}</td>
                <td class="py-2 pr-4">{{ byLocationCount(row) }}</td>
              </tr>
              <tr v-if="expandedRows.includes(i)" class="border-b bg-gray-50">
                <td colspan="7" class="py-4 px-4">
                  <div class="ml-4 space-y-4">
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div v-for="(value, key) in detailEntries(row)" :key="key" class="space-y-1">
                        <span class="font-semibold text-gray-700 text-xs uppercase tracking-tight">{{ key }}</span>
                        <span class="text-gray-900 block font-mono text-xs">{{ value }}</span>
                      </div>
                    </div>
                    <div v-if="byLocationList(row).length > 0" class="pt-3 border-t border-gray-200">
                      <h4 class="font-semibold text-gray-700 text-sm mb-2">By location (same unit price)</h4>
                      <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs">
                          <thead>
                            <tr class="border-b text-gray-600">
                              <th class="py-1 pr-3 font-medium">Location</th>
                              <th class="py-1 pr-3 font-medium">Line total</th>
                              <th class="py-1 pr-3 font-medium">Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(loc, li) in byLocationList(row)" :key="li" class="border-b border-gray-100">
                              <td class="py-1 pr-3">{{ loc.locationName || '—' }}</td>
                              <td class="py-1 pr-3 font-mono">€{{ euro(loc.lineTotal) }}</td>
                              <td class="py-1 pr-3 font-mono">{{ Number(loc.quantity ?? 0).toFixed(0) }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="paginationTotal > pageSize" class="mt-6 flex justify-center">
          <UPagination :page="page" :total="paginationTotal" :items-per-page="pageSize" @update:page="onPageChange" />
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

type ByLocationRow = {
  locationId?: unknown
  locationName?: string
  lineTotal?: number
  quantity?: number
}

type ProductAggRow = {
  productId?: string | number
  productName?: string
  unit_price?: number
  total_revenue?: number
  total_quantity?: number
  byLocation?: ByLocationRow[]
  [key: string]: unknown
}

function defaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return {
    startDate: start.toISOString().split('T')[0]!,
    endDate: end.toISOString().split('T')[0]!,
  }
}

const { startDate: defaultStart, endDate: defaultEnd } = defaultDateRange()

const filters = reactive({
  startDate: defaultStart,
  endDate: defaultEnd,
  locationId: 'all',
  search: '',
  minRevenue: 0,
})

const data = ref<ProductAggRow[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const expandedRows = ref<number[]>([])
const page = ref(1)
const pageSize = 50
const paginationTotal = ref(0)
const rangeTotals = ref({ total_revenue: 0, total_quantity: 0 })
const apiLocations = ref<{ _id: string; name: string }[]>([])

const locationOptions = computed(() => [
  { label: 'All locations', value: 'all' },
  ...apiLocations.value.map((l: { _id: string; name: string }) => ({ label: l.name, value: l._id })),
])

const totalRevenue = computed(() => rangeTotals.value.total_revenue)
const totalQuantity = computed(() => rangeTotals.value.total_quantity)

const euro = (v: unknown) => Number(v ?? 0).toFixed(2)

const byLocationCount = (row: ProductAggRow) => (Array.isArray(row.byLocation) ? row.byLocation.length : 0)

const byLocationList = (row: ProductAggRow): ByLocationRow[] => (Array.isArray(row.byLocation) ? row.byLocation : [])

const detailEntries = (row: ProductAggRow) => {
  const skip = new Set(['byLocation'])
  return Object.fromEntries(Object.entries(row).filter(([k]) => !skip.has(k)))
}

const fetchData = async (resetPage = false) => {
  if (resetPage) page.value = 1
  loading.value = true
  error.value = null
  expandedRows.value = []
  try {
    const params = new URLSearchParams({
      groupBy: 'product',
      page: String(page.value),
      pageSize: String(pageSize),
      startDate: filters.startDate,
      endDate: filters.endDate,
    })
    if (filters.search.trim()) params.set('productSearch', filters.search.trim())
    if (filters.minRevenue > 0) params.set('minRevenue', String(filters.minRevenue))
    if (filters.locationId && filters.locationId !== 'all') params.set('locationId', filters.locationId)
    const response = await $fetch<{
      success: boolean
      data?: ProductAggRow[]
      pagination?: { totalCount: number }
      totals?: { total_revenue: number; total_quantity: number; record_count: number }
      locations?: { _id: string; name: string }[]
    }>(`/api/sales-aggregated?${params}`)
    if (response.success) {
      data.value = response.data ?? []
      paginationTotal.value = response.pagination?.totalCount ?? data.value.length
      rangeTotals.value = {
        total_revenue: response.totals?.total_revenue ?? 0,
        total_quantity: response.totals?.total_quantity ?? 0,
      }
      if (Array.isArray(response.locations)) apiLocations.value = response.locations
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
  const d = defaultDateRange()
  filters.startDate = d.startDate
  filters.endDate = d.endDate
  filters.locationId = 'all'
  filters.search = ''
  filters.minRevenue = 0
  void fetchData(true)
}

const toggleExpanded = (index: number) => {
  const idx = expandedRows.value.indexOf(index)
  if (idx > -1) {
    expandedRows.value.splice(idx, 1)
  } else {
    expandedRows.value.push(index)
  }
}

onMounted(() => {
  void fetchData(true)
})
</script>
