<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Sales by Product (V2)</h1>
      <p class="text-gray-500">
        One row per <strong>business_date</strong> × location × product × unit price from <code class="text-xs">bork_sales_by_product</code> (same line math as V1 raw path).
      </p>
    </div>

    <UCard v-if="collectionHint" class="border-amber-200 bg-amber-50/50">
      <p class="text-sm text-amber-900"><strong>Source:</strong> {{ collectionHint }}</p>
    </UCard>

    <UCard v-if="error" class="border-red-200">
      <p class="text-red-600"><strong>Error:</strong> {{ error }}</p>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
      </template>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div class="space-y-2">
          <label class="text-sm font-medium">Start (business date)</label>
          <UInput v-model="filters.startDate" type="date" @update:model-value="() => fetchData(true)" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">End (business date)</label>
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
          <UInput v-model="filters.search" placeholder="Filter…" @update:model-value="() => fetchData(true)" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Min line total (period)</label>
          <UInput v-model.number="filters.minRevenue" type="number" placeholder="0" @update:model-value="() => fetchData(true)" />
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        <UButton variant="outline" @click="resetFilters">Reset</UButton>
      </div>
    </UCard>

    <div v-if="paginationTotal > 0" class="grid gap-4 md:grid-cols-3">
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Total line value</span>
        </template>
        <p class="text-2xl font-bold">€{{ totalRevenue.toFixed(2) }}</p>
      </UCard>
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Total quantity</span>
        </template>
        <p class="text-2xl font-bold">{{ totalQuantity.toFixed(0) }}</p>
      </UCard>
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Rows</span>
        </template>
        <p class="text-2xl font-bold">{{ paginationTotal }}</p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Lines ({{ paginationTotal }} total · {{ data.length }} on this page)</h2>
      </template>
      <div v-if="loading" class="py-8 text-center text-gray-500">Loading...</div>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Business date</th>
                <th class="pb-2 pr-4 font-medium">Location</th>
                <th class="pb-2 pr-4 font-medium">Product</th>
                <th class="pb-2 pr-4 font-medium">Product ID</th>
                <th class="pb-2 pr-4 font-medium">Unit price</th>
                <th class="pb-2 pr-4 font-medium">Line total</th>
                <th class="pb-2 pr-4 font-medium">Qty</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in data"
                :key="`prod-v2-${String(row.business_date)}-${String(row.productId)}-${row.unit_price}-${i}`"
                class="border-b hover:bg-gray-50"
              >
                <td class="py-2 pr-4">{{ formatDate(row.business_date) }}</td>
                <td class="py-2 pr-4">{{ row.locationName || '—' }}</td>
                <td class="py-2 pr-4">{{ row.productName || 'Unknown' }}</td>
                <td class="py-2 pr-4 text-xs font-mono text-gray-600">{{ row.productId }}</td>
                <td class="py-2 pr-4 font-mono">€{{ euro(row.unit_price) }}</td>
                <td class="py-2 pr-4 font-mono">€{{ euro(row.total_revenue) }}</td>
                <td class="py-2 pr-4">{{ Number(row.total_quantity ?? 0).toFixed(0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="paginationTotal > pageSize" class="mt-6 flex justify-center">
          <UPagination :page="page" :total="paginationTotal" :items-per-page="pageSize" @update:page="onPageChange" />
        </div>
        <p v-if="data.length === 0 && !loading" class="mt-4 text-center text-sm text-gray-500">No data.</p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'

const { startDate: defaultStart, endDate: defaultEnd } = getLast30DaysEndingYesterday()

const filters = reactive({
  startDate: defaultStart,
  endDate: defaultEnd,
  locationId: 'all',
  search: '',
  minRevenue: 0,
})

const data = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const apiLocations = ref<{ _id: string; name: string }[]>([])
const page = ref(1)
const pageSize = 50
const paginationTotal = ref(0)
const rangeTotals = ref({ total_revenue: 0, total_quantity: 0 })
const collectionHint = ref<string | null>(null)

const locationOptions = computed(() => [
  { label: 'All locations', value: 'all' },
  ...apiLocations.value.map((l) => ({ label: l.name, value: l._id })),
])

const totalRevenue = computed(() => rangeTotals.value.total_revenue)
const totalQuantity = computed(() => rangeTotals.value.total_quantity)

const euro = (v: unknown) => Number(v ?? 0).toFixed(2)

async function fetchData(resetPage = false) {
  if (resetPage) page.value = 1
  loading.value = true
  error.value = null
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
      data?: Record<string, unknown>[]
      pagination?: { totalCount: number }
      totals?: { total_revenue: number; total_quantity: number; record_count: number }
      locations?: { _id: string; name: string }[]
      summary?: { collection?: string; v2_suffix?: string | null }
    }>(`/api/sales-aggregated-v2?${params}`)
    if (response.success) {
      data.value = response.data ?? []
      paginationTotal.value = response.pagination?.totalCount ?? data.value.length
      rangeTotals.value = {
        total_revenue: response.totals?.total_revenue ?? 0,
        total_quantity: response.totals?.total_quantity ?? 0,
      }
      if (Array.isArray(response.locations)) apiLocations.value = response.locations
      const s = response.summary
      collectionHint.value = s?.collection
        ? `${s.collection}${s.v2_suffix ? ` · suffix ${JSON.stringify(s.v2_suffix)}` : ' · production'}`
        : null
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
  const r = getLast30DaysEndingYesterday()
  filters.startDate = r.startDate
  filters.endDate = r.endDate
  filters.locationId = 'all'
  filters.search = ''
  filters.minRevenue = 0
  void fetchData(true)
}

const formatDate = (date: unknown): string => {
  if (!date) return ''
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(() => {
  void fetchData(true)
})
</script>
