<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Hours Overview</h1>
      <p class="text-gray-500">View hours worked per day per location</p>
    </div>

    <UCard v-if="error" class="border-red-200">
      <p class="text-red-600"><strong>Error:</strong> {{ error }}</p>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
        <p class="text-sm text-gray-500">Filter and sort hours data</p>
      </template>
      <div class="grid gap-4 md:grid-cols-5">
        <div class="space-y-2">
          <label class="text-sm font-medium">Endpoint</label>
          <USelectMenu
            v-model="filters.endpoint"
            :items="endpointOptions"
            value-attribute="value"
            class="w-full"
            @update:model-value="() => fetchHours(true)"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Start Date</label>
          <UInput v-model="filters.startDate" type="date" @update:model-value="() => fetchHours(true)" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">End Date</label>
          <UInput v-model="filters.endDate" type="date" @update:model-value="() => fetchHours(true)" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Location</label>
          <USelectMenu
            v-model="filters.locationId"
            :items="locationOptions"
            value-attribute="value"
            class="w-full"
            @update:model-value="() => fetchHours(true)"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Sort By</label>
          <USelectMenu
            v-model="filters.sortBy"
            :items="sortByOptions"
            value-attribute="value"
            class="w-full"
            @update:model-value="() => fetchHours(true)"
          />
        </div>
      </div>
      <div class="mt-4 flex items-center gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Order</label>
          <USelectMenu
            v-model="filters.sortOrder"
            :items="[{ label: 'Descending', value: 'desc' }, { label: 'Ascending', value: 'asc' }]"
            value-attribute="value"
            class="w-36"
            @update:model-value="() => fetchHours(true)"
          />
        </div>
        <div class="mt-6 flex flex-wrap gap-2">
          <UButton variant="outline" @click="resetFilters">Reset Filters</UButton>
          <UButton :loading="loading" @click="() => fetchHours(true)">Refresh data</UButton>
        </div>
      </div>
    </UCard>

    <div v-if="paginationTotal > 0" class="grid gap-4 md:grid-cols-3">
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Total Hours</span>
        </template>
        <p class="text-2xl font-bold">{{ totalHours.toFixed(2) }}h</p>
      </UCard>
      <UCard>
        <template #header>
          <span class="text-sm font-medium">Total Cost</span>
        </template>
        <p class="text-2xl font-bold">€{{ totalCost.toFixed(2) }}</p>
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
        <h2 class="font-semibold">Hours by Day and Location</h2>
        <p class="text-sm text-gray-500">
          {{ loading ? 'Loading...' : `${paginationTotal} record(s) total · ${hoursData.length} on this page` }}
        </p>
        <p v-if="!loading" class="text-xs text-gray-500">
          Rows are grouped by each shift's work day (Europe/Amsterdam), not by when sync ran. Use Refresh after a sync if this tab was already open.
        </p>
      </template>
      <div v-if="loading" class="py-8 text-center text-gray-500">Loading hours data...</div>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Date</th>
                <th class="pb-2 pr-4 font-medium">Location</th>
                <th class="pb-2 pr-4 font-medium">Total Hours</th>
                <th class="pb-2 pr-4 font-medium">Total Cost</th>
                <th class="pb-2 pr-4 font-medium">Records</th>
                <th class="w-10 pb-2 pl-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              <!-- eslint-disable-next-line vue/no-v-for-template-key -- Vue 3 requires key on <template> when it has multiple root elements -->
              <template v-for="(row, i) in hoursData" :key="i">
                <tr
                  class="border-b cursor-pointer transition-colors hover:bg-gray-50"
                  :class="{ 'bg-gray-50': expandedRow === i }"
                  @click="expandedRow = expandedRow === i ? null : i"
                >
                  <td class="py-2 pr-4">{{ formatDate(row.date) }}</td>
                  <td class="py-2 pr-4">{{ row.location_name || 'Unknown' }}</td>
                  <td class="py-2 pr-4">{{ row.total_hours != null ? Number(row.total_hours).toFixed(2) : '-' }}</td>
                  <td class="py-2 pr-4">€{{ row.total_cost != null ? Number(row.total_cost).toFixed(2) : '0.00' }}</td>
                  <td class="py-2 pr-4">{{ row.record_count ?? 0 }}</td>
                  <td class="py-2 pl-2 text-right">
                    <UIcon
                      name="i-lucide-chevron-down"
                      :class="['size-4 inline-block transition-transform', expandedRow === i && 'rotate-180']"
                    />
                  </td>
                </tr>
                <tr v-if="expandedRow === i" class="border-b bg-gray-50/80">
                  <td colspan="6" class="p-4">
                    <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <h5 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Individual records (each shift) – verify how total is calculated</h5>
                      <p class="mb-2 text-xs text-gray-500">Support ID = Eitje shift id. If many rows show the same worker/start/end/hours but different Support IDs, the same shift was stored multiple times in raw data (e.g. Feb 2). If same Support ID repeated, one doc was duplicated.</p>
                      <div v-if="rowDetailLoading" class="py-4 text-center text-sm text-gray-500">Loading...</div>
                      <div v-else-if="rowDetailError" class="py-2 text-sm text-red-600">{{ rowDetailError }}</div>
                      <div v-else class="overflow-x-auto">
                        <table class="w-full text-left text-sm">
                          <thead>
                            <tr class="border-b text-gray-500">
                              <th class="w-10 pb-2 pr-4 font-medium">#</th>
                              <th class="pb-2 pr-4 font-medium">Worker</th>
                              <th class="pb-2 pr-4 font-medium">Team</th>
                              <th class="pb-2 pr-4 font-medium">Start</th>
                              <th class="pb-2 pr-4 font-medium">End</th>
                              <th class="pb-2 pr-4 font-medium">Support ID</th>
                              <th class="pb-2 font-medium text-right">Hours</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(rec, j) in rowDetailRecords" :key="j" class="border-b last:border-0">
                              <td class="py-1.5 pr-4 text-gray-500">{{ j + 1 }}</td>
                              <td class="py-1.5 pr-4">{{ rec.worker_name }}</td>
                              <td class="py-1.5 pr-4">{{ rec.team_name }}</td>
                              <td class="py-1.5 pr-4">{{ rec.start }}</td>
                              <td class="py-1.5 pr-4">{{ rec.end }}</td>
                              <td class="py-1.5 pr-4 font-mono text-xs">{{ rec.support_id || (rec.id ? rec.id.slice(0, 8) + '…' : '-') }}</td>
                              <td class="py-1.5 text-right font-mono">{{ Number(rec.hours).toFixed(2) }}</td>
                            </tr>
                          </tbody>
                          <tfoot v-if="rowDetailRecords.length > 0">
                            <tr class="border-t-2 font-medium">
                              <td class="py-2 pr-4" colspan="6">Sum of above</td>
                              <td class="py-2 text-right font-mono">{{ rowDetailSumHours.toFixed(2) }}</td>
                            </tr>
                            <tr class="text-gray-600">
                              <td class="py-1 pr-4 text-xs" colspan="6">Row total (from aggregation)</td>
                              <td class="py-1 text-right text-xs font-mono">{{ row.total_hours != null ? Number(row.total_hours).toFixed(2) : '-' }}</td>
                            </tr>
                          </tfoot>
                        </table>
                        <p v-if="rowDetailRecords.length > 0 && Math.abs(rowDetailSumHours - Number(row.total_hours ?? 0)) > 0.02" class="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-800">
                          <strong>Mismatch:</strong> sum of raw ({{ rowDetailSumHours.toFixed(2) }}) ≠ row total ({{ row.total_hours != null ? Number(row.total_hours).toFixed(2) : '-' }}). See “Check consistency” below for causes.
                        </p>
                        <p v-if="rowDetailRecords.length === 0 && (row.record_count ?? 0) > 0" class="py-2 text-sm text-amber-600">Could not load individual records. Row shows {{ row.record_count }} record(s) – possible data or filter mismatch.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div v-if="paginationTotal > pageSize" class="mt-6 flex justify-center">
          <UPagination :page="page" :total="paginationTotal" :items-per-page="pageSize" @update:page="onPageChange" />
        </div>
        <p v-if="hoursData.length === 0 && !loading" class="mt-4 text-center text-sm text-gray-500">
          Hours data is synced from the Eitje API. Configure Settings → Eitje API and run sync to populate.
        </p>
        <div class="mt-4 border-t pt-4">
          <UButton variant="outline" size="sm" :loading="consistencyLoading" @click="runConsistencyCheck">
            Check consistency (aggregation vs raw sums)
          </UButton>
          <div v-if="consistencyResult" class="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <p class="font-medium">
              {{ consistencyResult.summary.mismatch_count }} mismatch(es) of {{ consistencyResult.summary.total_rows }} rows.
            </p>
            <table v-if="consistencyResult.mismatches.length" class="mt-2 w-full text-left text-xs">
              <thead>
                <tr class="border-b text-gray-500">
                  <th class="pb-1 pr-2">Date</th>
                  <th class="pb-1 pr-2">Location</th>
                  <th class="pb-1 pr-2 text-right">Row total</th>
                  <th class="pb-1 pr-2 text-right">Raw sum</th>
                  <th class="pb-1 pr-2 text-right">Diff</th>
                  <th class="pb-1">Raw #</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(m, i) in consistencyResult.mismatches" :key="i" class="border-b">
                  <td class="py-1 pr-2">{{ m.date }}</td>
                  <td class="py-1 pr-2">{{ m.location_name }}</td>
                  <td class="py-1 pr-2 text-right font-mono">{{ m.row_total.toFixed(2) }}</td>
                  <td class="py-1 pr-2 text-right font-mono">{{ m.raw_sum.toFixed(2) }}</td>
                  <td class="py-1 pr-2 text-right font-mono text-amber-600">{{ m.diff.toFixed(2) }}</td>
                  <td class="py-1">{{ m.raw_count }} vs {{ m.row_record_count }}</td>
                </tr>
              </tbody>
            </table>
            <p class="mt-3 text-gray-600">{{ consistencyResult.possible_causes }}</p>
          </div>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const endpointOptions = [
  { label: 'Time Registration Shifts', value: 'time_registration_shifts' },
  { label: 'Revenue Days', value: 'revenue_days' },
  { label: 'Planning Shifts', value: 'planning_shifts' },
]
const sortByOptions = [
  { label: 'Date', value: 'date' },
  { label: 'Location', value: 'location_name' },
  { label: 'Total Hours', value: 'total_hours' },
]

const { startDate: defaultStart, endDate: defaultEnd } = getLast30DaysRange()

const filters = reactive({
  startDate: defaultStart,
  endDate: defaultEnd,
  locationId: 'all',
  endpoint: 'time_registration_shifts',
  sortBy: 'date',
  sortOrder: 'desc',
})

const hoursData = ref<Record<string, unknown>[]>([])
const locations = ref<{ _id: string; name: string }[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const page = ref(1)
const pageSize = 50
const paginationTotal = ref(0)
const rangeTotals = ref({ total_hours: 0, total_cost: 0, record_count: 0 })
const expandedRow = ref<number | null>(null)
const rowDetailRecords = ref<{ id: string; support_id: string; worker_name: string; team_name: string; start: string; end: string; hours: number }[]>([])
const rowDetailLoading = ref(false)
const rowDetailError = ref<string | null>(null)
const consistencyLoading = ref(false)
const consistencyResult = ref<{
  summary: { total_rows: number; ok_count: number; mismatch_count: number }
  mismatches: { date: string; location_name: string; location_id: string; row_total: number; raw_sum: number; raw_count: number; row_record_count: number; diff: number }[]
  possible_causes: string
} | null>(null)

const locationOptions = computed(() => [
  { label: 'All locations', value: 'all' },
  ...locations.value.map((l) => ({ label: l.name, value: l._id })),
])

const totalHours = computed(() => rangeTotals.value.total_hours)
const rowDetailSumHours = computed(() => rowDetailRecords.value.reduce((s, r) => s + Number(r.hours ?? 0), 0))
const totalCost = computed(() => rangeTotals.value.total_cost)
const totalRecords = computed(() => Math.round(rangeTotals.value.record_count))

function formatDate (d: unknown) {
  if (!d) return '-'
  const date = new Date(String(d))
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function fetchRowDetail (row: Record<string, unknown>) {
  rowDetailLoading.value = true
  rowDetailError.value = null
  rowDetailRecords.value = []
  try {
    const dateVal = row.date
    const dateStr = dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : String(dateVal ?? '').slice(0, 10)
    const locId = row.location_id != null ? String(row.location_id) : ''
    const locName = row.location_name != null ? String(row.location_name) : ''
    const params = new URLSearchParams()
    params.set('date', dateStr)
    // Only pass locationId if it looks like a valid ObjectId (24 hex chars) to avoid filtering issues with raw location IDs
    if (locId && /^[a-f0-9]{24}$/.test(locId)) {
      params.set('locationId', locId)
    } else if (locName && locName !== 'Unknown') {
      // Fallback: pass location name as filter
      params.set('locationName', locName)
    }
    params.set('endpoint', filters.endpoint ?? 'time_registration_shifts')
    const res = await $fetch<{ success: boolean; data?: { id: string; support_id: string; worker_name: string; team_name: string; start: string; end: string; hours: number }[] }>(`/api/hours-row-records?${params}`)
    rowDetailRecords.value = res.success ? (res.data ?? []) : []
  } catch (e: unknown) {
    rowDetailError.value = e instanceof Error ? e.message : 'Failed to load records'
  } finally {
    rowDetailLoading.value = false
  }
}

watch(expandedRow, (idx) => {
  if (idx === null) {
    rowDetailRecords.value = []
    rowDetailError.value = null
    return
  }
  const row = hoursData.value[idx]
  if (row) fetchRowDetail(row)
})

async function fetchHours (resetPage = false) {
  if (resetPage) page.value = 1
  loading.value = true
  error.value = null
  expandedRow.value = null
  try {
    const params = new URLSearchParams()
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (filters.locationId && filters.locationId !== 'all') params.set('locationId', filters.locationId)
    params.set('endpoint', filters.endpoint)
    params.set('groupBy', 'date_location')
    params.set('sortBy', filters.sortBy)
    params.set('sortOrder', filters.sortOrder)
    params.set('page', String(page.value))
    params.set('pageSize', String(pageSize))
    const res = await $fetch<{
      success: boolean
      data?: Record<string, unknown>[]
      locations?: { _id: string; name: string }[]
      pagination?: { totalCount: number }
      totals?: { total_hours: number; total_cost: number; record_count: number }
    }>(`/api/hours-aggregated?${params}`)
    if (res.success) {
      hoursData.value = res.data ?? []
      locations.value = res.locations ?? []
      paginationTotal.value = res.pagination?.totalCount ?? hoursData.value.length
      rangeTotals.value = {
        total_hours: res.totals?.total_hours ?? 0,
        total_cost: res.totals?.total_cost ?? 0,
        record_count: res.totals?.record_count ?? 0,
      }
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch hours data'
    hoursData.value = []
  } finally {
    loading.value = false
  }
}

function onPageChange (p: number) {
  page.value = p
  void fetchHours(false)
}

function resetFilters () {
  const r = getLast30DaysRange()
  filters.startDate = r.startDate
  filters.endDate = r.endDate
  filters.locationId = 'all'
  filters.endpoint = 'time_registration_shifts'
  filters.sortBy = 'date'
  filters.sortOrder = 'desc'
  void fetchHours(true)
}

async function runConsistencyCheck () {
  consistencyLoading.value = true
  consistencyResult.value = null
  try {
    const params = new URLSearchParams()
    params.set('startDate', filters.startDate ?? defaultStart)
    params.set('endDate', filters.endDate ?? defaultEnd)
    params.set('endpoint', filters.endpoint ?? 'time_registration_shifts')
    const res = await $fetch<{
      success: boolean
      summary: { total_rows: number; ok_count: number; mismatch_count: number }
      mismatches: { date: string; location_name: string; location_id: string; row_total: number; raw_sum: number; raw_count: number; row_record_count: number; diff: number }[]
      possible_causes: string
    }>(`/api/hours-consistency-check?${params}`)
    if (res.success) consistencyResult.value = res
  } catch {
    consistencyResult.value = null
  } finally {
    consistencyLoading.value = false
  }
}

onMounted(() => {
  void fetchHours(true)
})
</script>
