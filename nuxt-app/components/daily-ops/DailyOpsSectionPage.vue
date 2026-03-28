<template>
  <DailyOpsDashboardShell>
    <UAlert v-if="error" color="error" :title="String(error)" />

    <div v-else-if="pending" class="space-y-4">
      <USkeleton class="h-10 w-72 rounded-lg" />
      <USkeleton class="h-40 w-full rounded-lg" />
    </div>

    <div v-else-if="data" class="space-y-6">
      <header class="space-y-1">
        <h1 class="text-[34px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
          Daily Ops / {{ locationTitle }} / {{ data.title }}
        </h1>
        <p class="text-base text-gray-600">
          {{ data.range.startDate }} → {{ data.range.endDate }}
          <span class="text-gray-400">·</span>
          {{ data.range.period }}
        </p>
      </header>

      <UCard class="border-2 border-gray-900 bg-white">
        <p class="text-gray-600">
          {{ data.message }}
        </p>
      </UCard>
    </div>
  </DailyOpsDashboardShell>
</template>

<script setup lang="ts">
import type { DailyOpsSectionStubDto } from '~/types/daily-ops-dashboard'
type LocationRow = { _id: string; name: string }

const props = defineProps<{
  section: 'revenue' | 'productivity' | 'workload' | 'products' | 'insights'
}>()

const { dashboardQuery, locationId } = useDailyOpsDashboardRoute()
const { data: locationsRes } = await useFetch<{ success: boolean; data: LocationRow[] }>('/api/locations')

const locationTitle = computed(() => {
  if (!locationId.value) return 'All Locations'
  const rows = locationsRes.value?.data ?? []
  const hit = rows.find((row) => row._id === locationId.value)
  return hit?.name ?? 'Selected Location'
})

const url = computed(() => `/api/daily-ops/${props.section}`)

const { data, pending, error } = await useFetch<DailyOpsSectionStubDto>(url, {
  query: dashboardQuery,
})
</script>
