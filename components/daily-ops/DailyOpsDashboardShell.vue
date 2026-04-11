<template>
  <div class="space-y-7">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="w-full max-w-xs space-y-1.5">
        <label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Location</label>
        <USelectMenu
          :model-value="locationId ?? ''"
          :items="locationItems"
          value-key="value"
          placeholder="All locations"
          class="w-full"
          :ui="{
            base: 'h-9 rounded-md border border-gray-300 bg-white text-sm',
            trailingIcon: 'text-gray-500'
          }"
          @update:model-value="onLocationChange"
        />
      </div>
      <div class="inline-flex w-full max-w-max flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
        <NuxtLink
          v-for="opt in periodOptions"
          :key="opt.id"
          :to="{ path: route.path, query: { ...route.query, period: opt.id } }"
          replace
          prefetch
          class="rounded px-3 py-1.5 text-sm font-semibold no-underline transition-colors"
          :class="period === opt.id
            ? 'bg-gray-900 text-white'
            : 'text-gray-700 hover:bg-gray-100'"
        >
          {{ opt.label }}
        </NuxtLink>
      </div>
    </div>

    <nav aria-label="Daily Ops sections" class="inline-flex w-full flex-wrap gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
      <NuxtLink
        v-for="item in navItems"
        :key="item.key"
        :to="{ path: item.path, query: dashboardQuery }"
        class="inline-flex items-center rounded px-4 py-2 text-sm font-semibold no-underline transition-colors"
        :class="activeNav === item.key
          ? 'bg-gray-900 text-white'
          : 'text-gray-700 hover:bg-gray-100'"
      >
        {{ item.label }}
      </NuxtLink>
    </nav>

    <div class="min-w-0">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DailyOpsPeriodId } from '~/types/daily-ops-dashboard'

type LocationRow = { _id: string; name: string }

const route = useRoute()

const {
  period,
  locationId,
  dashboardQuery,
  activeNav,
  setLocation,
} = useDailyOpsDashboardRoute()

const periodOptions: { id: DailyOpsPeriodId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this-week', label: 'This Week' },
  { id: 'last-week', label: 'Last Week' },
]

const navItems = [
  { key: 'overview' as const, label: 'Daily Ops', path: '/daily-ops' },
  { key: 'revenue' as const, label: 'Revenue', path: '/daily-ops/revenue' },
  { key: 'productivity' as const, label: 'Productivity', path: '/daily-ops/productivity' },
  { key: 'workload' as const, label: 'Workload', path: '/daily-ops/workload' },
  { key: 'products' as const, label: 'Products', path: '/daily-ops/products' },
  { key: 'insights' as const, label: 'Insights', path: '/daily-ops/insights' },
]

const { data: locationsRes } = await useFetch<{ success: boolean; data: LocationRow[] }>('/api/locations')

const locationItems = computed(() => {
  const rows = locationsRes.value?.data ?? []
  return [{ label: 'All locations', value: '' }, ...rows.map((l) => ({ label: l.name, value: l._id }))]
})

function onLocationChange(value: unknown) {
  if (value === '' || value === undefined || value === null) {
    setLocation(null)
    return
  }
  if (typeof value === 'string') setLocation(value)
}
</script>
