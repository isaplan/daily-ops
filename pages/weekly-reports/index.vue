<template>
  <div class="space-y-6 p-4 md:p-6">
    <header>
      <h1 class="text-2xl font-bold text-gray-900">Reports Dashboard</h1>
      <p class="text-sm text-gray-600">Latest sealed weekly and monthly reports per venue.</p>
    </header>

    <div class="flex flex-wrap items-center gap-3">
      <label class="text-sm font-medium text-gray-700">Venue</label>
      <select
        :value="locationId"
        class="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        @change="onLocationChange"
      >
        <option v-for="v in venueOptions" :key="v.locationId" :value="v.locationId">
          {{ v.locationName }}
        </option>
      </select>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <section class="rounded-lg border border-gray-200 bg-white">
        <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-700">Weekly Reports</h2>
          <NuxtLink
            :to="`/weekly-reports/all?type=weekly&location=${locationId}`"
            class="text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            View all
          </NuxtLink>
        </div>
        <div v-if="weeklyPending" class="px-4 py-6 text-sm text-gray-500">Loading…</div>
        <ul v-else class="divide-y divide-gray-100">
          <li v-for="item in weeklyList" :key="`${item.weekKey}-${item.locationId}`">
            <NuxtLink
              :to="`/weekly-reports/${item.weekKey}?location=${item.locationId}`"
              class="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div>
                <p class="font-semibold text-gray-900">{{ item.label }}</p>
                <p class="text-xs text-gray-500">{{ item.startDate }} → {{ item.endDate }}</p>
              </div>
              <span
                v-if="item.frozenAt"
                class="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
              >
                Locked
              </span>
            </NuxtLink>
          </li>
          <li v-if="!weeklyList.length" class="px-4 py-8 text-center text-sm text-gray-500">
            No weekly reports yet.
          </li>
        </ul>
      </section>

      <section class="rounded-lg border border-gray-200 bg-white">
        <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-700">Monthly Reports</h2>
          <NuxtLink
            :to="`/weekly-reports/all?type=monthly&location=${locationId}`"
            class="text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            View all
          </NuxtLink>
        </div>
        <div v-if="monthlyPending" class="px-4 py-6 text-sm text-gray-500">Loading…</div>
        <ul v-else class="divide-y divide-gray-100">
          <li v-for="item in monthlyList" :key="`${item.monthKey}-${item.locationId}`">
            <NuxtLink
              :to="`/weekly-reports/month/${item.monthKey}?location=${item.locationId}`"
              class="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div>
                <p class="font-semibold text-gray-900">{{ item.label }}</p>
                <p class="text-xs text-gray-500">{{ item.startDate }} → {{ item.endDate }}</p>
              </div>
              <span
                v-if="item.frozenAt"
                class="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
              >
                Locked
              </span>
            </NuxtLink>
          </li>
          <li v-if="!monthlyList.length" class="px-4 py-8 text-center text-sm text-gray-500">
            No monthly reports yet.
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: weeklyReportsIndexPage
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-17T00:00:00.000Z
 * @description: Reports dashboard — last 4 weekly + last 4 monthly
 * @last-fix: [2026-07-17] Two-column dashboard with weekly/monthly previews
 * @adr-ref: ADR-015
 */

import type { MonthlyReportListItem } from '~/types/monthlyReportDocument'
import type { WeeklyReportListItem } from '~/types/weeklyReportDocument'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import { getIsoWeekFromYmd } from '~/utils/dailyOpsPeriodBreakdownChart'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'

definePageMeta({ keepalive: false })

const route = useRoute()
const router = useRouter()

const locationId = computed(() => {
  const l = route.query.location
  if (typeof l === 'string' && l.length > 0) return l
  return DAILY_OPS_PROFIT_VENUE_LOCATIONS[0]?.locationId ?? ''
})

const venueOptions = DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => ({
  locationId: v.locationId,
  locationName: v.label,
}))

const listQuery = computed(() => {
  const q: Record<string, string> = { limit: '4' }
  if (locationId.value) q.locationId = locationId.value
  return new URLSearchParams(q).toString()
})

const { data: weeklyRes, pending: weeklyPending } = useFetch<{ success: boolean; data: WeeklyReportListItem[] }>(
  () => `/api/weekly-reports?${listQuery.value}`,
  { key: 'dashboard-weekly-reports', watch: [listQuery] },
)

const { data: monthlyRes, pending: monthlyPending } = useFetch<{ success: boolean; data: MonthlyReportListItem[] }>(
  () => `/api/monthly-reports?${listQuery.value}`,
  { key: 'dashboard-monthly-reports', watch: [listQuery] },
)

const weeklyList = computed(() => weeklyRes.value?.data ?? [])
const monthlyList = computed(() => monthlyRes.value?.data ?? [])

function onLocationChange(e: Event) {
  const id = (e.target as HTMLSelectElement).value
  router.replace({ path: route.path, query: { ...route.query, location: id } })
}

onMounted(() => {
  const period = route.query.period
  if (period === 'last-week') {
    const range = resolveDailyOpsPeriod('last-week')
    const weekKey = getIsoWeekFromYmd(range.startDate)
    const loc = typeof route.query.location === 'string' ? route.query.location : locationId.value
    router.replace(`/weekly-reports/${weekKey}?location=${loc}`)
  }
})
</script>
