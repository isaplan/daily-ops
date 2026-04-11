<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Hours by Team</h1>
      <p class="text-gray-500">View total hours worked per team</p>
    </div>
    <UCard v-if="error"><p class="text-red-600"><strong>Error:</strong> {{ error }}</p></UCard>
    <UCard>
      <template #header><h2 class="font-semibold">Filters</h2></template>
      <div class="grid gap-4 md:grid-cols-4">
        <div class="space-y-2"><label class="text-sm font-medium">Endpoint</label><USelectMenu v-model="filters.endpoint" :items="endpointOptions" value-attribute="value" class="w-full" @update:model-value="() => fetchHours(true)" /></div>
        <div class="space-y-2"><label class="text-sm font-medium">Start Date</label><UInput v-model="filters.startDate" type="date" @update:model-value="() => fetchHours(true)" /></div>
        <div class="space-y-2"><label class="text-sm font-medium">End Date</label><UInput v-model="filters.endDate" type="date" @update:model-value="() => fetchHours(true)" /></div>
        <div class="space-y-2"><label class="text-sm font-medium">Sort By</label><USelectMenu v-model="filters.sortBy" :items="[{ label: 'Team Name', value: 'team_name' }, { label: 'Total Hours', value: 'total_hours' }]" value-attribute="value" class="w-full" @update:model-value="() => fetchHours(true)" /></div>
      </div>
      <div class="mt-4 flex gap-4">
        <div class="space-y-2"><label class="text-sm font-medium">Order</label><USelectMenu v-model="filters.sortOrder" :items="[{ label: 'Descending', value: 'desc' }, { label: 'Ascending', value: 'asc' }]" value-attribute="value" class="w-36" @update:model-value="() => fetchHours(true)" /></div>
        <UButton variant="outline" class="mt-6" @click="resetFilters">Reset</UButton>
      </div>
    </UCard>
    <div v-if="paginationTotal > 0" class="grid gap-4 md:grid-cols-3">
      <UCard><template #header><span class="text-sm font-medium">Total Hours</span></template><p class="text-2xl font-bold">{{ totalHours.toFixed(2) }}h</p></UCard>
      <UCard><template #header><span class="text-sm font-medium">Total Cost</span></template><p class="text-2xl font-bold">€{{ totalCost.toFixed(2) }}</p></UCard>
      <UCard><template #header><span class="text-sm font-medium">Teams (range)</span></template><p class="text-2xl font-bold">{{ paginationTotal }}</p></UCard>
    </div>
    <UCard>
      <template #header><h2 class="font-semibold">Hours by Team</h2><p class="text-sm text-gray-500">{{ loading ? 'Loading...' : `${paginationTotal} total · ${hoursData.length} on this page` }}</p></template>
      <div v-if="loading" class="py-8 text-center text-gray-500">Loading...</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead><tr class="border-b"><th class="pb-2 pr-4 font-medium">Team</th><th class="pb-2 pr-4 font-medium">Total Hours</th><th class="pb-2 pr-4 font-medium">Total Cost</th><th class="pb-2 pr-4 font-medium">Workers</th><th class="pb-2 font-medium">Records</th></tr></thead>
          <tbody>
            <tr v-for="(row, i) in hoursData" :key="i" class="border-b last:border-0">
              <td class="py-2 pr-4">{{ row.team_name ?? 'Unknown' }}</td>
              <td class="py-2 pr-4">{{ Number(row.total_hours ?? 0).toFixed(2) }}</td>
              <td class="py-2 pr-4">€{{ Number(row.total_cost ?? 0).toFixed(2) }}</td>
              <td class="py-2 pr-4">{{ row.worker_count ?? 0 }}</td>
              <td class="py-2">{{ row.record_count ?? 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="paginationTotal > pageSize" class="mt-6 flex justify-center">
        <UPagination :page="page" :total="paginationTotal" :items-per-page="pageSize" @update:page="onPageChange" />
      </div>
      <p v-if="hoursData.length === 0 && !loading" class="mt-4 text-center text-sm text-gray-500">Hours data is synced from the Eitje API.</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const endpointOptions = [{ label: 'Time Registration Shifts', value: 'time_registration_shifts' }, { label: 'Revenue Days', value: 'revenue_days' }, { label: 'Planning Shifts', value: 'planning_shifts' }]
const { startDate: defaultStart, endDate: defaultEnd } = getLast30DaysRange()
const filters = reactive({ startDate: defaultStart, endDate: defaultEnd, endpoint: 'time_registration_shifts', sortBy: 'total_hours', sortOrder: 'desc' })
const hoursData = ref<Record<string, unknown>[]>([]), loading = ref(true), error = ref<string | null>(null)
const page = ref(1), pageSize = 50, paginationTotal = ref(0)
const rangeTotals = ref({ total_hours: 0, total_cost: 0, record_count: 0 })
const totalHours = computed(() => rangeTotals.value.total_hours)
const totalCost = computed(() => rangeTotals.value.total_cost)
async function fetchHours (resetPage = false) {
  if (resetPage) page.value = 1
  loading.value = true; error.value = null
  try {
    const params = new URLSearchParams()
    if (filters.startDate) params.set('startDate', filters.startDate); if (filters.endDate) params.set('endDate', filters.endDate)
    params.set('endpoint', filters.endpoint); params.set('groupBy', 'team'); params.set('sortBy', filters.sortBy); params.set('sortOrder', filters.sortOrder)
    params.set('page', String(page.value)); params.set('pageSize', String(pageSize))
    const res = await $fetch<{ success: boolean; data?: Record<string, unknown>[]; pagination?: { totalCount: number }; totals?: { total_hours: number; total_cost: number; record_count: number } }>(`/api/hours-aggregated?${params}`)
    if (res.success) {
      hoursData.value = res.data ?? []
      paginationTotal.value = res.pagination?.totalCount ?? hoursData.value.length
      rangeTotals.value = {
        total_hours: res.totals?.total_hours ?? 0,
        total_cost: res.totals?.total_cost ?? 0,
        record_count: res.totals?.record_count ?? 0,
      }
    } else hoursData.value = []
  } catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Failed to fetch'; hoursData.value = [] }
  finally { loading.value = false }
}
function onPageChange (p: number) { page.value = p; void fetchHours(false) }
function resetFilters () { const r = getLast30DaysRange(); filters.startDate = r.startDate; filters.endDate = r.endDate; filters.endpoint = 'time_registration_shifts'; filters.sortBy = 'total_hours'; filters.sortOrder = 'desc'; void fetchHours(true) }
onMounted(() => { void fetchHours(true) })
</script>
