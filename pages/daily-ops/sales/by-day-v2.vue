<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Sales by Day (V2)</h1>
      <p class="text-gray-500">
        Register business days (06:00–05:59) from <code class="text-xs">bork_business_days</code>. Defaults end yesterday; optional filter for 24 filled hour slots.
      </p>
    </div>

    <UCard v-if="collectionHint" class="border-amber-200 bg-amber-50/50">
      <p class="text-sm text-amber-900">
        <strong>API data source:</strong> {{ collectionHint }}
      </p>
    </UCard>

    <UCard v-if="error" class="border-red-200">
      <p class="text-red-600"><strong>Error:</strong> {{ error }}</p>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
      </template>
      <div class="grid gap-4 md:grid-cols-3">
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
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-4">
        <UCheckbox v-model="filters.fullDaysOnly" label="Only full days (24 register hour slots with data)" @update:model-value="() => fetchData(true)" />
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
          <span class="text-sm font-medium">Rows</span>
        </template>
        <p class="text-2xl font-bold">{{ paginationTotal }}</p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Business days ({{ paginationTotal }} total · {{ data.length }} on this page)
        </h2>
      </template>
      <div v-if="loading" class="py-8 text-center text-gray-500">Loading...</div>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Business date</th>
                <th class="pb-2 pr-4 font-medium">Location</th>
                <th class="pb-2 pr-4 font-medium">Hour slots w/ data</th>
                <th class="pb-2 pr-4 font-medium">Revenue</th>
                <th class="pb-2 pr-4 font-medium">Qty</th>
                <th class="pb-2 pr-4 font-medium">Line count</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in data" :key="`day-v2-${String(row.business_date)}-${String(row.locationId)}-${i}`" class="border-b hover:bg-gray-50">
                <td class="py-2 pr-4">{{ formatDate(row.business_date) }}</td>
                <td class="py-2 pr-4">{{ row.locationName || 'Unknown' }}</td>
                <td class="py-2 pr-4">{{ row.hour_buckets ?? '—' }}</td>
                <td class="py-2 pr-4">€{{ Number(row.total_revenue ?? 0).toFixed(2) }}</td>
                <td class="py-2 pr-4">{{ Number(row.total_quantity ?? 0).toFixed(0) }}</td>
                <td class="py-2 pr-4">{{ row.record_count ?? 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="paginationTotal > pageSize" class="mt-6 flex justify-center">
          <UPagination :page="page" :total="paginationTotal" :items-per-page="pageSize" @update:page="onPageChange" />
        </div>
        <p v-if="data.length === 0 && !loading" class="mt-4 text-center text-sm text-gray-500">
          No rows. Rebuild V2 aggregates (e.g. <code class="text-xs">BORK_AGG_V2=1</code> backfill) and match <code class="text-xs">BORK_AGG_V2_SUFFIX</code> with this app.
        </p>
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
  fullDaysOnly: true,
})

const data = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const locations = ref<{ _id: string; name: string }[]>([])
const page = ref(1)
const pageSize = 50
const paginationTotal = ref(0)
const rangeTotals = ref({ total_revenue: 0, total_quantity: 0, record_count: 0 })
const collectionHint = ref<string | null>(null)

const locationOptions = computed(() => [
  { label: 'All Locations', value: 'all' },
  ...locations.value.map((l) => ({ label: l.name, value: l._id })),
])

const totalRevenue = computed(() => rangeTotals.value.total_revenue)
const totalQuantity = computed(() => rangeTotals.value.total_quantity)

const fetchData = async (resetPage = false) => {
  if (resetPage) page.value = 1
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams({
      startDate: filters.startDate,
      endDate: filters.endDate,
      locationId: filters.locationId,
      groupBy: 'day',
      page: String(page.value),
      pageSize: String(pageSize),
    })
    if (!filters.fullDaysOnly) params.set('fullDaysOnly', 'false')
    const response = await $fetch<{
      success: boolean
      data?: Record<string, unknown>[]
      locations?: { _id: string; name: string }[]
      pagination?: { totalCount: number }
      totals?: { total_revenue: number; total_quantity: number; record_count: number }
      summary?: { collection?: string; v2_suffix?: string | null }
    }>(`/api/sales-aggregated-v2?${params}`)
    if (response.success) {
      data.value = response.data ?? []
      locations.value = response.locations ?? []
      paginationTotal.value = response.pagination?.totalCount ?? data.value.length
      rangeTotals.value = {
        total_revenue: response.totals?.total_revenue ?? 0,
        total_quantity: response.totals?.total_quantity ?? 0,
        record_count: response.totals?.record_count ?? 0,
      }
      const s = response.summary
      collectionHint.value = s?.collection
        ? `${s.collection}${
            s.v2_suffix
              ? ` · env BORK_AGG_V2_SUFFIX=${JSON.stringify(s.v2_suffix)}`
              : ' · production (no suffix)'
          }`
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
  filters.fullDaysOnly = true
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
