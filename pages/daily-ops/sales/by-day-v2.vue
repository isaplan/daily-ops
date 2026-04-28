<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Sales by Day (V2)</h1>
      <p class="text-gray-500">
        One document per location and <strong>register business_date</strong> in <code class="text-xs">bork_business_days</code> and <code class="text-xs">bork_sales_by_day</code>
        (version suffix from <code class="text-xs">BORK_AGG_VERSION_SUFFIX</code>, default <code class="text-xs">_v2</code>).
      </p>
    </div>

    <UCard v-if="collectionHint" class="border border-gray-200 bg-gray-50">
      <p class="text-sm font-medium text-gray-900">Data source (not an error)</p>
      <p class="mt-1 text-sm text-gray-700">{{ collectionHint }}</p>
      <p class="mt-2 text-xs text-gray-600">
        Nuxt only auto-loads <code class="text-xs">.env</code> and <code class="text-xs">.env.local</code> — not <code class="text-xs">.env.digitalocean.local</code>.
        Put <code class="text-xs">BORK_AGG_VERSION_SUFFIX=_v2</code> in <code class="text-xs">.env.local</code>, then restart <code class="text-xs">pnpm dev</code>.
        Rebuilds use <code class="text-xs">BORK_AGG_REBUILD_SUFFIX</code> (default <code class="text-xs">_v2</code>) for writes.
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
        <UCheckbox
          v-model="filters.fullDaysOnly"
          label="Only days with 24 register-hour buckets that have line data (strict)"
          @update:model-value="() => fetchData(true)"
        />
        <UButton variant="outline" @click="resetFilters">Reset</UButton>
      </div>
    </UCard>

    <div v-if="paginationTotal > 0" class="grid gap-4 md:grid-cols-3">
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Line revenue (Σ lines)</span>
        </template>
        <p class="text-2xl font-bold">€{{ totalRevenue.toFixed(2) }}</p>
      </UCard>
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Line quantity</span>
        </template>
        <p class="text-2xl font-bold">{{ totalQuantity.toFixed(0) }}</p>
      </UCard>
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Day rows (page)</span>
        </template>
        <p class="text-2xl font-bold">{{ paginationTotal }}</p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">By business day</h2>
        <p class="text-sm text-gray-500">{{ paginationTotal }} row(s) total · {{ data.length }} on this page</p>
      </template>

      <div class="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <UButton
          v-for="t in tabDefs"
          :key="t.id"
          size="sm"
          :variant="activeTab === t.id ? 'solid' : 'ghost'"
          @click="activeTab = t.id"
        >
          {{ t.label }}
        </UButton>
      </div>

      <div v-if="loading" class="py-8 text-center text-gray-500">Loading...</div>
      <template v-else>
        <div v-show="activeTab === 'revenue'" class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Business date</th>
                <th class="pb-2 pr-4 font-medium">Location</th>
                <th class="pb-2 pr-4 font-medium">Hour slots (lines)</th>
                <th class="pb-2 pr-4 font-medium">Line revenue</th>
                <th class="pb-2 pr-4 font-medium">Paymodes Σ</th>
                <th class="pb-2 pr-4 font-medium">Qty</th>
                <th class="pb-2 pr-4 font-medium">Line count</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in data" :key="`rev-${String(row.business_date)}-${String(row.locationId)}-${i}`" class="border-b hover:bg-gray-50">
                <td class="py-2 pr-4">{{ formatDate(row.business_date) }}</td>
                <td class="py-2 pr-4">{{ row.locationName || 'Unknown' }}</td>
                <td class="py-2 pr-4">{{ row.hour_buckets ?? '—' }}</td>
                <td class="py-2 pr-4">€{{ euro(row.total_revenue) }}</td>
                <td class="py-2 pr-4">€{{ euro(row.paymode_total) }}</td>
                <td class="py-2 pr-4">{{ num(row.total_quantity) }}</td>
                <td class="py-2 pr-4">{{ row.record_count ?? 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-show="activeTab === 'products'" class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Business date</th>
                <th class="pb-2 pr-4 font-medium">Location</th>
                <th class="pb-2 pr-4 font-medium">Product</th>
                <th class="pb-2 pr-4 font-medium">Revenue</th>
                <th class="pb-2 pr-4 font-medium">Qty</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in flatProducts" :key="`p-${i}`" class="border-b hover:bg-gray-50">
                <td class="py-2 pr-4">{{ formatDate(r.business_date) }}</td>
                <td class="py-2 pr-4">{{ r.locationName }}</td>
                <td class="py-2 pr-4">{{ r.productName }}</td>
                <td class="py-2 pr-4">€{{ euro(r.revenue) }}</td>
                <td class="py-2 pr-4">{{ num(r.quantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-show="activeTab === 'workers'" class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Business date</th>
                <th class="pb-2 pr-4 font-medium">Location</th>
                <th class="pb-2 pr-4 font-medium">Worker</th>
                <th class="pb-2 pr-4 font-medium">Revenue</th>
                <th class="pb-2 pr-4 font-medium">Qty</th>
                <th class="pb-2 pr-4 font-medium">Lines</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in flatWorkers" :key="`w-${i}`" class="border-b hover:bg-gray-50">
                <td class="py-2 pr-4">{{ formatDate(r.business_date) }}</td>
                <td class="py-2 pr-4">{{ r.locationName }}</td>
                <td class="py-2 pr-4">{{ r.workerName }}</td>
                <td class="py-2 pr-4">€{{ euro(r.total_revenue) }}</td>
                <td class="py-2 pr-4">{{ num(r.total_quantity) }}</td>
                <td class="py-2 pr-4">{{ r.record_count ?? 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-show="activeTab === 'payments'" class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Business date</th>
                <th class="pb-2 pr-4 font-medium">Location</th>
                <th class="pb-2 pr-4 font-medium">Paymode</th>
                <th class="pb-2 pr-4 font-medium">Group</th>
                <th class="pb-2 pr-4 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in flatPaymodes" :key="`pm-${i}`" class="border-b hover:bg-gray-50">
                <td class="py-2 pr-4">{{ formatDate(r.business_date) }}</td>
                <td class="py-2 pr-4">{{ r.locationName }}</td>
                <td class="py-2 pr-4">{{ r.paymodeName }}</td>
                <td class="py-2 pr-4">{{ r.groupName || '—' }}</td>
                <td class="py-2 pr-4">€{{ euro(r.total_revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-show="activeTab === 'guests'" class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Business date</th>
                <th class="pb-2 pr-4 font-medium">Location</th>
                <th class="pb-2 pr-4 font-medium">Guest account</th>
                <th class="pb-2 pr-4 font-medium">Revenue</th>
                <th class="pb-2 pr-4 font-medium">Qty</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in flatGuests" :key="`g-${i}`" class="border-b hover:bg-gray-50">
                <td class="py-2 pr-4">{{ formatDate(r.business_date) }}</td>
                <td class="py-2 pr-4">{{ r.locationName }}</td>
                <td class="py-2 pr-4">{{ r.accountName }}</td>
                <td class="py-2 pr-4">€{{ euro(r.total_revenue) }}</td>
                <td class="py-2 pr-4">{{ num(r.total_quantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="paginationTotal > pageSize" class="mt-6 flex justify-center">
          <UPagination :page="page" :total="paginationTotal" :items-per-page="pageSize" @update:page="onPageChange" />
        </div>
        <p v-if="data.length === 0 && !loading" class="mt-4 text-center text-sm text-gray-500">
          No rows. Run a V2 rebuild (e.g. <code class="text-xs">BORK_V2_REBUILD_CONFIRM=1</code> on <code class="text-xs">scripts/rebuild-bork-v2-date-range.ts</code>), then align
          <code class="text-xs">BORK_AGG_VERSION_SUFFIX</code> to your target collection version.
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'

type DayRow = Record<string, unknown>

const tabDefs = [
  { id: 'revenue' as const, label: 'Revenue' },
  { id: 'products' as const, label: 'Products' },
  { id: 'workers' as const, label: 'Workers' },
  { id: 'payments' as const, label: 'Payment types' },
  { id: 'guests' as const, label: 'Guest accounts' },
]

const activeTab = ref<(typeof tabDefs)[number]['id']>('revenue')

const { startDate: defaultStart, endDate: defaultEnd } = getLast30DaysEndingYesterday()

const filters = reactive({
  startDate: defaultStart,
  endDate: defaultEnd,
  locationId: 'all',
  fullDaysOnly: false,
})

const data = ref<DayRow[]>([])
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
  ...locations.value.map((l: { _id: string; name: string }) => ({ label: l.name, value: l._id })),
])

const totalRevenue = computed(() => rangeTotals.value.total_revenue)
const totalQuantity = computed(() => rangeTotals.value.total_quantity)

const euro = (v: unknown) => Number(v ?? 0).toFixed(2)
const num = (v: unknown) => Number(v ?? 0).toFixed(0)

const flatProducts = computed(() => {
  const out: {
    business_date: string
    locationName: string
    productName: string
    revenue: number
    quantity: number
  }[] = []
  for (const row of data.value) {
    const loc = String(row.locationName ?? 'Unknown')
    const bd = String(row.business_date ?? '')
    const arr = Array.isArray(row.products_day) ? row.products_day : []
    for (const p of arr as { productName?: string; revenue?: number; quantity?: number }[]) {
      out.push({
        business_date: bd,
        locationName: loc,
        productName: String(p.productName ?? ''),
        revenue: Number(p.revenue ?? 0),
        quantity: Number(p.quantity ?? 0),
      })
    }
  }
  return out
})

const flatWorkers = computed(() => {
  const out: {
    business_date: string
    locationName: string
    workerName: string
    total_revenue: number
    total_quantity: number
    record_count: number
  }[] = []
  for (const row of data.value) {
    const loc = String(row.locationName ?? 'Unknown')
    const bd = String(row.business_date ?? '')
    const arr = Array.isArray(row.workers_day) ? row.workers_day : []
    for (const w of arr as {
      workerName?: string
      total_revenue?: number
      total_quantity?: number
      record_count?: number
    }[]) {
      out.push({
        business_date: bd,
        locationName: loc,
        workerName: String(w.workerName ?? ''),
        total_revenue: Number(w.total_revenue ?? 0),
        total_quantity: Number(w.total_quantity ?? 0),
        record_count: Number(w.record_count ?? 0),
      })
    }
  }
  return out
})

const flatPaymodes = computed(() => {
  const out: {
    business_date: string
    locationName: string
    paymodeName: string
    groupName: string
    total_revenue: number
  }[] = []
  for (const row of data.value) {
    const loc = String(row.locationName ?? 'Unknown')
    const bd = String(row.business_date ?? '')
    const arr = Array.isArray(row.paymodes_day) ? row.paymodes_day : []
    for (const pm of arr as { paymodeName?: string; groupName?: string; total_revenue?: number }[]) {
      out.push({
        business_date: bd,
        locationName: loc,
        paymodeName: String(pm.paymodeName ?? ''),
        groupName: String(pm.groupName ?? ''),
        total_revenue: Number(pm.total_revenue ?? 0),
      })
    }
  }
  return out
})

const flatGuests = computed(() => {
  const out: {
    business_date: string
    locationName: string
    accountName: string
    total_revenue: number
    total_quantity: number
  }[] = []
  for (const row of data.value) {
    const loc = String(row.locationName ?? 'Unknown')
    const bd = String(row.business_date ?? '')
    const arr = Array.isArray(row.guest_accounts_day) ? row.guest_accounts_day : []
    for (const g of arr as { accountName?: string; total_revenue?: number; total_quantity?: number }[]) {
      out.push({
        business_date: bd,
        locationName: loc,
        accountName: String(g.accountName ?? ''),
        total_revenue: Number(g.total_revenue ?? 0),
        total_quantity: Number(g.total_quantity ?? 0),
      })
    }
  }
  return out
})

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
    if (filters.fullDaysOnly) params.set('fullDaysOnly', 'true')
    const response = await $fetch<{
      success: boolean
      data?: DayRow[]
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
              ? ` · env BORK_AGG_VERSION_SUFFIX=${JSON.stringify(s.v2_suffix)}`
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
  filters.fullDaysOnly = false
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
