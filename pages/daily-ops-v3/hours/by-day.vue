<template>
  <div class="space-y-6 p-8">
    <div>
      <h1 class="text-3xl font-bold">Hours by Day (V3 - Correct Business Day)</h1>
      <p class="text-gray-500">View total hours worked per day with correct business day logic (06:00-05:59 UTC)</p>
    </div>

    <UCard v-if="error">
      <p class="text-red-600"><strong>Error:</strong> {{ error }}</p>
    </UCard>

    <!-- Filters -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
        <p class="text-sm text-gray-500">Filter and sort hours data</p>
      </template>
      <div class="grid gap-4 md:grid-cols-3">
        <div class="space-y-2">
          <label class="text-sm font-medium">Start Date</label>
          <UInput v-model="filters.startDate" type="date" @update:model-value="() => fetchHours(true)" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">End Date</label>
          <UInput v-model="filters.endDate" type="date" @update:model-value="() => fetchHours(true)" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Sort Order</label>
          <USelectMenu v-model="filters.sortOrder" :items="sortOrderOptions" value-attribute="value" class="w-[140px]" @update:model-value="() => fetchHours(true)" />
        </div>
      </div>
      <div class="mt-4 flex items-center gap-4">
        <UButton variant="outline" class="mt-6" @click="resetFilters">Reset Filters</UButton>
      </div>
    </UCard>

    <!-- Summary Stats -->
    <div v-if="hoursData.length > 0" class="grid gap-4 md:grid-cols-3">
      <UCard>
        <template #header><span class="text-sm font-medium">Total Hours</span></template>
        <p class="text-2xl font-bold">{{ totalHours.toFixed(2) }}h</p>
      </UCard>
      <UCard>
        <template #header><span class="text-sm font-medium">Average Daily Hours</span></template>
        <p class="text-2xl font-bold">{{ averageDailyHours.toFixed(2) }}h</p>
      </UCard>
      <UCard>
        <template #header><span class="text-sm font-medium">Total Days</span></template>
        <p class="text-2xl font-bold">{{ hoursData.length }}</p>
      </UCard>
    </div>

    <!-- Hours Table -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">Hours by Day (V3)</h2>
        <p class="text-sm text-gray-500">
          {{ loading ? 'Loading...' : `${hoursData.length} day(s) with data` }}
        </p>
      </template>
      <div v-if="loading" class="py-8 text-center text-gray-500">Loading hours data...</div>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Business Date</th>
                <th class="pb-2 pr-4 font-medium">Total Hours</th>
                <th class="pb-2 pr-4 font-medium">Locations</th>
                <th class="pb-2 font-medium">Part 1 / Part 2</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in hoursData" :key="i" class="border-b last:border-0">
                <td class="py-2 pr-4 font-mono">{{ row.businessDate }}</td>
                <td class="py-2 pr-4">{{ Number(row.totalHours ?? 0).toFixed(2) }}h</td>
                <td class="py-2 pr-4">{{ row.locationCount ?? 0 }}</td>
                <td class="py-2 pr-4 text-xs text-gray-600">
                  Part1: {{ Number(row.part1Hours ?? 0).toFixed(1) }}h / Part2: {{ Number(row.part2Hours ?? 0).toFixed(1) }}h
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="hoursData.length === 0" class="mt-4 text-center space-y-2">
          <p class="text-sm text-gray-500">No hours data found for the selected date range.</p>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'

const sortOrderOptions = [
  { label: 'Descending', value: 'desc' },
  { label: 'Ascending', value: 'asc' },
]

const { startDate: defaultStart, endDate: defaultEnd } = getLast30DaysRange()
const filters = reactive({
  startDate: defaultStart,
  endDate: defaultEnd,
  sortOrder: 'desc',
})

const hoursData = ref<Record<string, unknown>[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const totalHours = computed(() => {
  return hoursData.value.reduce((sum, row) => sum + (Number(row.totalHours) || 0), 0)
})

const averageDailyHours = computed(() => {
  if (hoursData.value.length === 0) return 0
  return totalHours.value / hoursData.value.length
})

function formatDate(d: unknown) {
  if (!d) return '-'
  return new Date(String(d)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function fetchHours(resetPage = false) {
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams()
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    params.set('sortOrder', filters.sortOrder)

    const res = await $fetch<{
      success: boolean
      data?: Record<string, unknown>[]
    }>(`/api/v3/hours-by-day?${params}`)

    if (res.success) {
      hoursData.value = (res.data ?? []).sort((a, b) => {
        const aDate = String(a.businessDate || '')
        const bDate = String(b.businessDate || '')
        return filters.sortOrder === 'desc' ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate)
      })
    } else {
      hoursData.value = []
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch'
    hoursData.value = []
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  const r = getLast30DaysRange()
  filters.startDate = r.startDate
  filters.endDate = r.endDate
  filters.sortOrder = 'desc'
  void fetchHours(true)
}

onMounted(() => {
  void fetchHours(true)
})
</script>
