<template>
  <div class="min-w-0">
    <div
      class="fixed right-10 top-3"
    >
      <div class="space-y-2">
        <div class="flex justify-end">
          <div class="inline-flex max-w-max flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-1">
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

        <div class="flex justify-end">
          <nav aria-label="Daily Ops sections"
            class="inline-flex max-w-max flex-wrap gap-1 rounded-md border-2 border-gray-900 bg-white p-1"
          >
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
        </div>

        <div class="flex justify-end">
          <nav
            aria-label="Location shortcuts"
            class="inline-flex max-w-max flex-wrap gap-1 rounded-md border-2 border-gray-900 bg-white p-1"
          >
            <button
              type="button"
              class="rounded px-3 py-1.5 text-sm font-semibold transition-colors"
              :class="!locationId
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-100'"
              @click="setLocation(null)"
            >
              All
            </button>
          <button
            v-for="s in resolvedLocationShortcuts"
            :key="s.abbrev"
            type="button"
            class="rounded px-3 py-1.5 text-sm font-semibold transition-colors"
            :class="locationId === s.id
              ? 'bg-gray-900 text-white'
              : 'text-gray-700 hover:bg-gray-100'"
            :aria-label="`${s.longLabel}, ${s.abbrev}`"
            @click="s.id != null && setLocation(s.id)"
          >
            <span class="md:hidden">{{ s.abbrev }}</span>
            <span class="hidden md:inline">{{ s.longLabel }}</span>
          </button>
          </nav>
        </div>
      </div>
    </div>

    <div class="min-w-0 pt-40">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DailyOpsPeriodId } from '~/types/daily-ops-dashboard'

type LocationRow = { _id: string; name: string; abbreviation?: string }

const DAILY_OPS_SHORTCUT_ABBREVS = ['VKB', 'BEA', 'LAT'] as const

function unifiedRowMatchesShortcut(row: LocationRow, abbrev: string): boolean {
  const a = abbrev.toUpperCase()
  if (row.abbreviation?.toUpperCase() === a) return true
  const n = row.name.toLowerCase()
  if (a === 'VKB') return /kinsbergen/i.test(n)
  if (a === 'BEA') {
    const c = n.replace(/\s+/g, '')
    return (c.includes('bar') && c.includes('bea')) || c.includes('barbea')
  }
  if (a === 'LAT') {
    if (/amour/.test(n) && /toujours/.test(n)) return true
    return n.replace(/[\s']/g, '') === 'lamour'
  }
  return false
}

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

const navItems = computed(() => {
  const prefix = '/daily-ops'
  return [
    { key: 'overview' as const, label: 'Daily Ops', path: prefix },
    { key: 'revenue' as const, label: 'Revenue', path: `${prefix}/revenue` },
    { key: 'productivity' as const, label: 'Productivity', path: `${prefix}/productivity` },
    { key: 'products' as const, label: 'Products', path: `${prefix}/products` },
    { key: 'insights' as const, label: 'Insights', path: `${prefix}/insights` },
    { key: 'inbox' as const, label: 'Inbox', path: `${prefix}/inbox` },
  ]
})

const { data: locationsRes } = await useFetch<{ success: boolean; data: LocationRow[] }>('/api/daily-ops/locations')

const resolvedLocationShortcuts = computed(() => {
  const rows = locationsRes.value?.data ?? []
  return DAILY_OPS_SHORTCUT_ABBREVS.map((abbrev) => {
    const row = rows.find((l: LocationRow) => unifiedRowMatchesShortcut(l, abbrev))
    return {
      abbrev,
      longLabel: row?.name ?? abbrev,
      id: row?._id ?? null,
    }
  })
})
</script>
