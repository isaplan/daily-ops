<template>
  <div class="space-y-6 p-8">
    <div>
      <h1 class="text-3xl font-bold">Hours by Day</h1>
      <p class="text-gray-500">View total hours worked per day across all locations</p>
    </div>

    <UCard v-if="error">
      <p class="text-red-600"><strong>Error:</strong> {{ error }}</p>
    </UCard>

    <!-- Filters (same as Next.js) -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
        <p class="text-sm text-gray-500">Filter and sort hours data</p>
      </template>
      <div class="grid gap-4 md:grid-cols-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Endpoint</label>
          <USelectMenu v-model="filters.endpoint" :items="endpointOptions" value-attribute="value" class="w-full" @update:model-value="fetchHours" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Start Date</label>
          <UInput v-model="filters.startDate" type="date" @update:model-value="fetchHours" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">End Date</label>
          <UInput v-model="filters.endDate" type="date" @update:model-value="fetchHours" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Sort By</label>
          <USelectMenu v-model="filters.sortBy" :items="sortByOptions" value-attribute="value" class="w-full" @update:model-value="fetchHours" />
        </div>
      </div>
      <div class="mt-4 flex items-center gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Sort Order</label>
          <USelectMenu v-model="filters.sortOrder" :items="sortOrderOptions" value-attribute="value" class="w-[140px]" @update:model-value="fetchHours" />
        </div>
        <UButton variant="outline" class="mt-6" @click="resetFilters">Reset Filters</UButton>
      </div>
    </UCard>

    <!-- Summary Stats (same as Next.js) -->
    <div v-if="hoursData.length > 0" class="grid gap-4 md:grid-cols-3">
      <UCard>
        <template #header><span class="text-sm font-medium">Total Hours</span></template>
        <p class="text-2xl font-bold">{{ totalHours.toFixed(2) }}h</p>
      </UCard>
      <UCard>
        <template #header><span class="text-sm font-medium">Total Cost</span></template>
        <p class="text-2xl font-bold">€{{ totalCost.toFixed(2) }}</p>
      </UCard>
      <UCard>
        <template #header><span class="text-sm font-medium">Total Records</span></template>
        <p class="text-2xl font-bold">{{ totalRecords }}</p>
      </UCard>
    </div>

    <!-- Hours Table (same columns as Next.js DataTable) -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">Hours by Day</h2>
        <p class="text-sm text-gray-500">
          {{ loading ? 'Loading...' : `${hoursData.length} ${hoursData.length === 1 ? 'day' : 'days'} found` }}
        </p>
      </template>
      <div v-if="loading" class="py-8 text-center text-gray-500">Loading hours data...</div>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Date</th>
                <th class="pb-2 pr-4 font-medium">Total Hours</th>
                <th class="pb-2 pr-4 font-medium">Total Cost</th>
                <th class="pb-2 pr-4 font-medium">Locations</th>
                <th class="pb-2 font-medium">Records</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in hoursData" :key="i" class="border-b last:border-0">
                <td class="py-2 pr-4">{{ formatDate(row.date) }}</td>
                <td class="py-2 pr-4">{{ Number(row.total_hours ?? 0).toFixed(2) }}</td>
                <td class="py-2 pr-4">€{{ Number(row.total_cost ?? 0).toFixed(2) }}</td>
                <td class="py-2 pr-4">{{ row.location_count ?? 0 }}</td>
                <td class="py-2">{{ row.record_count ?? 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="hoursData.length === 0" class="mt-4 text-center space-y-2">
          <p class="text-sm text-gray-500">Hours data is synced from the Eitje API.</p>
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
  { label: 'Total Hours', value: 'total_hours' },
]
const sortOrderOptions = [
  { label: 'Descending', value: 'desc' },
  { label: 'Ascending', value: 'asc' },
]
const today = new Date()
const defaultStart = '2025-01-01', defaultEnd = today.toISOString().split('T')[0]
const filters = reactive({ startDate: defaultStart, endDate: defaultEnd, endpoint: 'time_registration_shifts', sortBy: 'date', sortOrder: 'desc' })
const hoursData = ref<Record<string, unknown>[]>([]), loading = ref(true), error = ref<string | null>(null)
const totalHours = computed(() => hoursData.value.reduce((s, r) => s + Number(r.total_hours ?? 0), 0))
const totalCost = computed(() => hoursData.value.reduce((s, r) => s + Number(r.total_cost ?? 0), 0))
const totalRecords = computed(() => hoursData.value.reduce((s, r) => s + Number(r.record_count ?? 0), 0))
function formatDate (d: unknown) { if (!d) return '-'; return new Date(String(d)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }
async function fetchHours () {
  loading.value = true; error.value = null
  try {
    const params = new URLSearchParams()
    if (filters.startDate) params.set('startDate', filters.startDate); if (filters.endDate) params.set('endDate', filters.endDate)
    params.set('endpoint', filters.endpoint); params.set('groupBy', 'day'); params.set('sortBy', filters.sortBy); params.set('sortOrder', filters.sortOrder)
    const res = await $fetch<{ success: boolean; data?: Record<string, unknown>[] }>(`/api/hours-aggregated?${params}`)
    hoursData.value = res.success ? (res.data ?? []) : []
  } catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Failed to fetch'; hoursData.value = [] }
  finally { loading.value = false }
}
function resetFilters () { filters.startDate = defaultStart; filters.endDate = defaultEnd; filters.endpoint = 'time_registration_shifts'; filters.sortBy = 'date'; filters.sortOrder = 'desc'; fetchHours() }
onMounted(() => fetchHours())
</script>
