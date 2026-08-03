<template>
  <div class="space-y-6 p-4 md:p-6">
    <header class="space-y-1">
      <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Weekly Reports V2</p>
      <h1 class="text-2xl font-bold text-gray-900">Weekly Reports V2</h1>
      <p class="text-sm text-gray-600">
        Iteration sandbox — same data as V1.
        <NuxtLink :to="`/weekly-reports?location=${locationId}`" class="underline hover:text-gray-900">
          Back to dashboard
        </NuxtLink>
      </p>
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

    <section class="rounded-lg border border-gray-200 bg-white">
      <div class="border-b border-gray-200 px-4 py-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-700">Weeks</h2>
      </div>
      <div v-if="pending" class="px-4 py-6 text-sm text-gray-500">Loading…</div>
      <ul v-else class="divide-y divide-gray-100">
        <li v-for="item in weeklyList" :key="`${item.weekKey}-${item.locationId}`">
          <NuxtLink
            :to="`/weekly-reports/v2/${item.weekKey}?location=${item.locationId}`"
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
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: weeklyReportsV2IndexPage
 * @created: 2026-07-28T16:32:00.000Z
 * @last-modified: 2026-07-28T16:32:00.000Z
 * @description: Weekly Reports V2 list — sandbox entry for iterating on weekly UI
 * @last-fix: [2026-07-28] Initial V2 list page
 * @adr-ref: ADR-015
 */

import type { WeeklyReportListItem } from '~/types/weeklyReportDocument'
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
  const q: Record<string, string> = { limit: '12' }
  if (locationId.value) q.locationId = locationId.value
  return new URLSearchParams(q).toString()
})

const { data: weeklyRes, pending } = useFetch<{ success: boolean; data: WeeklyReportListItem[] }>(
  () => `/api/weekly-reports?${listQuery.value}`,
  { key: 'weekly-reports-v2-list', watch: [listQuery] },
)

const weeklyList = computed(() => weeklyRes.value?.data ?? [])

function onLocationChange(e: Event) {
  const id = (e.target as HTMLSelectElement).value
  router.replace({ path: route.path, query: { ...route.query, location: id } })
}
</script>
