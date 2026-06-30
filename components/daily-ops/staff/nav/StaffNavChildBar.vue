<template>
  <nav
    aria-label="Staff sections"
    class="scrollbar-hide inline-flex w-max max-w-full min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-md border-2 border-gray-900 bg-white p-1"
  >
    <NuxtLink
      v-for="item in items"
      :key="item.key"
      :to="item.to"
      class="inline-flex shrink-0 items-center rounded px-4 py-2 text-sm font-semibold no-underline transition-colors"
      :class="activeKey === item.key
        ? 'bg-gray-900 text-white'
        : 'text-gray-700 hover:bg-gray-100'"
    >
      {{ item.label }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import {
  defaultStaffNavQuery,
  isStaffNavMode,
} from '~/utils/dailyOpsStaffNav/modes'
import { amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'

const route = useRoute()
const { dashboardQuery } = useDailyOpsDashboardRoute()

const STAFF_BASE = '/daily-ops/staff'

function staffSubQuery(): Record<string, string> {
  const anchor = amsterdamOpenRegisterBusinessDateYmd()
  const defaults = defaultStaffNavQuery(anchor)
  const q: Record<string, string> = { ...defaults }
  if (isStaffNavMode(String(route.query.mode ?? ''))) {
    q.mode = String(route.query.mode)
  }
  if (typeof route.query.slot === 'string' && route.query.slot) {
    q.slot = route.query.slot
  }
  if (typeof route.query.location === 'string' && route.query.location) {
    q.location = route.query.location
  }
  return q
}

const items = computed(() => {
  const overviewQuery = { ...dashboardQuery.value }
  delete overviewQuery.member
  const sub = staffSubQuery()
  return [
    { key: 'overview' as const, label: 'Overview', to: { path: STAFF_BASE, query: overviewQuery } },
    { key: 'totals' as const, label: 'Totals', to: { path: `${STAFF_BASE}/totals`, query: sub } },
    {
      key: 'productivity' as const,
      label: 'Productivity',
      to: { path: `${STAFF_BASE}/productivity`, query: overviewQuery },
    },
    { key: 'plusmin' as const, label: '± Hours', to: { path: `${STAFF_BASE}/plusmin`, query: sub } },
  ]
})

const activeKey = computed(() => {
  if (route.path.includes('/staff/totals')) return 'totals'
  if (route.path.includes('/staff/productivity')) return 'productivity'
  if (route.path.includes('/staff/plusmin')) return 'plusmin'
  return 'overview'
})
</script>
