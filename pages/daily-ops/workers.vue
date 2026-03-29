<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Workers</h1>
      <p class="text-gray-500">Total hours and cost per worker</p>
    </div>

    <UCard v-if="error">
      <p class="text-red-600"><strong>Error:</strong> {{ error }}</p>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
      </template>
      <div class="grid gap-4 md:grid-cols-5">
        <div class="space-y-2">
          <label class="text-sm font-medium">Data source</label>
          <USelectMenu
            v-model="filters.source"
            :items="sourceOptions"
            value-attribute="value"
            class="w-full"
            @update:model-value="fetchHours"
          />
        </div>
        <div v-if="filters.source === 'synced'" class="space-y-2">
          <label class="text-sm font-medium">Worker scope</label>
          <USelectMenu
            v-model="filters.workerScope"
            :items="workerScopeOptions"
            value-attribute="value"
            class="w-full"
            @update:model-value="fetchHours"
          />
        </div>
        <template v-if="filters.source === 'synced'">
          <div class="space-y-2">
            <label class="text-sm font-medium">Endpoint</label>
            <USelectMenu
              v-model="filters.endpoint"
              :items="endpointOptions"
              value-attribute="value"
              class="w-full"
              @update:model-value="fetchHours"
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Start Date</label>
            <UInput
              v-model="filters.startDate"
              type="date"
              :disabled="filters.workerScope === 'active_3m'"
              @update:model-value="fetchHours"
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">End Date</label>
            <UInput
              v-model="filters.endDate"
              type="date"
              :disabled="filters.workerScope === 'active_3m'"
              @update:model-value="fetchHours"
            />
          </div>
        </template>
      </div>
      <div class="mt-4 flex flex-wrap items-end gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Sort By</label>
          <USelectMenu
            v-model="filters.sortBy"
            :items="sortByOptions"
            value-attribute="value"
            class="w-[200px]"
            @update:model-value="fetchHours"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Order</label>
          <USelectMenu
            v-model="filters.sortOrder"
            :items="sortOrderOptions"
            value-attribute="value"
            class="w-[140px]"
            @update:model-value="fetchHours"
          />
        </div>
        <UButton variant="outline" @click="resetFilters">Reset</UButton>
      </div>
      <p v-if="filters.source === 'synced' && filters.workerScope === 'active_3m'" class="mt-3 text-xs text-gray-500">
        Showing workers active in the last 3 months.
      </p>
    </UCard>

    <div v-if="hoursData.length > 0" class="grid gap-4 md:grid-cols-3">
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
          <span class="text-sm font-medium">Total Workers</span>
        </template>
        <p class="text-2xl font-bold">{{ hoursData.length }}</p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Workers</h2>
        <p class="text-sm text-gray-500">
          {{ loading ? 'Loading...' : `${hoursData.length} worker(s) found` }}
        </p>
      </template>
      <div v-if="loading" class="py-8 text-center text-gray-500">
        Loading...
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b">
              <th class="pb-2 pr-4 font-medium w-8"></th>
              <th class="pb-2 pr-4 font-medium">Worker</th>
              <th class="pb-2 pr-4 font-medium text-right">Total Hours</th>
              <th class="pb-2 pr-4 font-medium text-right">Total Cost</th>
              <th class="pb-2 pr-4 font-medium text-right">Hourly Cost</th>
              <th class="pb-2 pr-4 font-medium">Team</th>
              <th class="pb-2 pr-4 font-medium">Contract Type</th>
              <th class="pb-2 pr-4 font-medium">Locations</th>
              <th class="pb-2 font-medium">Records</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(row, i) in hoursData" :key="i">
              <tr class="border-b last:border-0 cursor-pointer hover:bg-gray-50" @click="toggleWorkerExpanded(i)">
                <td class="py-2 pr-4">
                  <UIcon 
                    :name="expandedWorkers.has(i) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                    class="size-4"
                  />
                </td>
                <td class="py-2 pr-4 font-medium">{{ row.worker_name ?? 'Unknown' }}</td>
                <td class="py-2 pr-4 text-right">{{ Number(row.total_hours ?? 0).toFixed(2) }}</td>
                <td class="py-2 pr-4 text-right">€{{ Number(row.total_cost ?? 0).toFixed(2) }}</td>
                <td class="py-2 pr-4 text-right">
                  {{ Number(row.total_hours ?? 0) > 0 ? `€${(Number(row.total_cost ?? 0) / Number(row.total_hours ?? 1)).toFixed(2)}/h` : '-' }}
                </td>
                <td class="py-2 pr-4">{{ row.team_name ?? '-' }}</td>
                <td class="py-2 pr-4">{{ row.contract_type ?? '-' }}</td>
                <td class="py-2 pr-4">{{ row.location_count ?? 0 }}</td>
                <td class="py-2">{{ row.record_count ?? 0 }}</td>
              </tr>
              <tr v-if="expandedWorkers.has(i)" class="border-b bg-gray-50/50">
                <td colspan="9" class="p-4">
                  <div class="rounded-lg border border-gray-200 bg-white p-4">
                    <h5 class="mb-3 text-sm font-semibold text-gray-900">Work Breakdown by Location & Team</h5>
                    <div v-if="workerTeamBreakdown[i] && workerTeamBreakdown[i].length > 0" class="overflow-x-auto">
                      <table class="w-full text-left text-xs">
                        <thead>
                          <tr class="border-b text-gray-600">
                            <th class="pb-2 pr-3 font-medium">Location</th>
                            <th class="pb-2 pr-3 font-medium">Team</th>
                            <th class="pb-2 pr-3 font-medium text-right">Hours</th>
                            <th class="pb-2 pr-3 font-medium text-right">Cost</th>
                            <th class="pb-2 pr-3 font-medium text-right">Hourly Rate</th>
                            <th class="pb-2 font-medium text-right">Records</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(item, j) in workerTeamBreakdown[i]" :key="j" class="border-b last:border-0">
                            <td class="py-2 pr-3">{{ item.location_name ?? 'Unknown' }}</td>
                            <td class="py-2 pr-3">{{ item.team_name ?? 'Unknown' }}</td>
                            <td class="py-2 pr-3 text-right font-mono">{{ Number(item.total_hours ?? 0).toFixed(2) }}h</td>
                            <td class="py-2 pr-3 text-right font-mono">€{{ Number(item.total_cost ?? 0).toFixed(2) }}</td>
                            <td class="py-2 pr-3 text-right font-mono">€{{ Number(item.hourly_rate ?? 0).toFixed(2) }}/h</td>
                            <td class="py-2 text-right">{{ item.record_count ?? 0 }}</td>
                          </tr>
                        </tbody>
                        <tfoot class="border-t-2 font-medium text-gray-900">
                          <tr>
                            <td colspan="2" class="py-2 pr-3">Total for {{ row.worker_name }}</td>
                            <td class="py-2 pr-3 text-right font-mono">{{ workerTeamBreakdown[i].reduce((sum: number, t: any) => sum + Number(t.total_hours ?? 0), 0).toFixed(2) }}h</td>
                            <td class="py-2 pr-3 text-right font-mono">€{{ workerTeamBreakdown[i].reduce((sum: number, t: any) => sum + Number(t.total_cost ?? 0), 0).toFixed(2) }}</td>
                            <td class="py-2 pr-3 text-right font-mono">€{{ (workerTeamBreakdown[i].reduce((sum: number, t: any) => sum + Number(t.total_cost ?? 0), 0) / workerTeamBreakdown[i].reduce((sum: number, t: any) => sum + Number(t.total_hours ?? 0), 1)).toFixed(2) }}/h</td>
                            <td class="py-2 text-right">{{ workerTeamBreakdown[i].reduce((sum: number, t: any) => sum + Number(t.record_count ?? 0), 0) }}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <p v-else class="text-sm text-gray-500">No work breakdown available</p>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <p v-if="hoursData.length === 0 && !loading" class="mt-4 text-center text-sm text-gray-500">
        Hours data is synced from the Eitje API.
      </p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Workers' })

const endpointOptions = [
  { label: 'Time Registration Shifts', value: 'time_registration_shifts' },
  { label: 'Revenue Days', value: 'revenue_days' },
  { label: 'Planning Shifts', value: 'planning_shifts' },
]
const sourceOptions = [
  { label: 'Synced shifts (date range)', value: 'synced' },
  { label: 'Contract totals (CSV, all-time)', value: 'contracts' },
]
const workerScopeOptions = [
  { label: 'Active workers (last 3 months)', value: 'active_3m' },
  { label: 'All workers (selected dates)', value: 'all' },
]
const sortByOptions = [
  { label: 'Worker Name', value: 'worker_name' },
  { label: 'Total Hours', value: 'total_hours' },
  { label: 'Total Cost', value: 'total_cost' },
]
const sortOrderOptions = [
  { label: 'Descending', value: 'desc' },
  { label: 'Ascending', value: 'asc' },
]

const today = new Date()
const defaultStart = '2025-01-01'
const defaultEnd = today.toISOString().split('T')[0]

const filters = reactive({
  startDate: defaultStart,
  endDate: defaultEnd,
  endpoint: 'time_registration_shifts',
  source: 'synced' as 'synced' | 'contracts',
  workerScope: 'active_3m' as 'active_3m' | 'all',
  sortBy: 'total_hours',
  sortOrder: 'desc',
})

const hoursData = ref<Record<string, unknown>[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const expandedWorkers = ref(new Set<number>())
const workerTeamBreakdown = ref<Record<number, any[]>>({})

const totalHours = computed(() => hoursData.value.reduce((s, r) => s + Number(r.total_hours ?? 0), 0))
const totalCost = computed(() => hoursData.value.reduce((s, r) => s + Number(r.total_cost ?? 0), 0))

function getThreeMonthsAgoDate (): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return d.toISOString().split('T')[0] || ''
}

async function fetchHours () {
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams()
    if (filters.source === 'synced') {
      const start = filters.workerScope === 'active_3m' ? getThreeMonthsAgoDate() : filters.startDate
      const end = filters.workerScope === 'active_3m' ? defaultEnd : filters.endDate
      if (start) params.set('startDate', start)
      if (end) params.set('endDate', end)
      params.set('endpoint', filters.endpoint)
    } else {
      params.set('source', 'contracts')
    }
    params.set('groupBy', 'worker')
    params.set('sortBy', filters.sortBy)
    params.set('sortOrder', filters.sortOrder)

    const res = await $fetch<{ success: boolean; data?: Record<string, unknown>[] }>(`/api/hours-aggregated?${params}`)
    hoursData.value = res.success ? (res.data ?? []) : []
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch'
    hoursData.value = []
  } finally {
    loading.value = false
  }
}

function resetFilters () {
  filters.startDate = defaultStart
  filters.endDate = defaultEnd
  filters.endpoint = 'time_registration_shifts'
  filters.source = 'synced'
  filters.workerScope = 'active_3m'
  filters.sortBy = 'total_hours'
  filters.sortOrder = 'desc'
  fetchHours()
}

async function toggleWorkerExpanded (idx: number) {
  if (expandedWorkers.value.has(idx)) {
    expandedWorkers.value.delete(idx)
    delete workerTeamBreakdown.value[idx]
  } else {
    expandedWorkers.value.add(idx)
    await fetchWorkerTeamBreakdown(idx)
  }
}

async function fetchWorkerTeamBreakdown (idx: number) {
  try {
    const row = hoursData.value[idx]
    if (!row) return

    // Query aggregation collection for this worker's breakdown by location and team
    const params = new URLSearchParams()
    if (filters.source === 'synced') {
      const start = filters.workerScope === 'active_3m' ? getThreeMonthsAgoDate() : filters.startDate
      const end = filters.workerScope === 'active_3m' ? defaultEnd : filters.endDate
      if (start) params.set('startDate', start)
      if (end) params.set('endDate', end)
      params.set('endpoint', filters.endpoint)
    } else {
      params.set('source', 'contracts')
    }
    // groupBy=worker_location_team will show per-location, per-team breakdown
    params.set('groupBy', 'worker_location_team')
    params.set('workerId', String(row.worker_id ?? ''))
    params.set('sortBy', 'total_hours')
    params.set('sortOrder', 'desc')

    const res = await $fetch<{ success: boolean; data?: Record<string, unknown>[] }>(`/api/hours-aggregated?${params}`)
    const breakdown = res.success ? (res.data ?? []) : []
    
    workerTeamBreakdown.value[idx] = breakdown
  } catch (e: unknown) {
    console.error('Failed to fetch team breakdown:', e)
    workerTeamBreakdown.value[idx] = []
  }
}

onMounted(() => fetchHours())
</script>
