<template>
  <div class="space-y-6 p-4 md:p-6">
    <header>
      <h1 class="text-2xl font-bold text-gray-900">Weekly Reports</h1>
      <p class="text-sm text-gray-600">Sealed weekly documents per venue — findings, todos, and agreements.</p>
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

    <div v-if="listPending" class="text-sm text-gray-500">Loading reports…</div>

    <ul v-else class="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
      <li v-for="item in list" :key="`${item.weekKey}-${item.locationId}`">
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
            Frozen
          </span>
        </NuxtLink>
      </li>
      <li v-if="!list.length" class="px-4 py-8 text-center text-sm text-gray-500">
        No weekly reports yet. They are built automatically each Monday, or open a week directly.
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: weeklyReportsIndexPage
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T22:00:00.000Z
 * @description: Weekly Reports list page
 * @last-fix: [2026-07-14] Redirect ?period=last-week to sealed week document
 * @adr-ref: ADR-015
 */

import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import { getIsoWeekFromYmd } from '~/utils/dailyOpsPeriodBreakdownChart'
import { useWeeklyReportDocument } from '~/composables/useWeeklyReportDocument'

definePageMeta({ keepalive: false })

const route = useRoute()
const router = useRouter()
const { list, listPending, locationId, venueOptions, setLocation, refreshList } = useWeeklyReportDocument()

onMounted(() => {
  const period = route.query.period
  if (period === 'last-week') {
    const range = resolveDailyOpsPeriod('last-week')
    const weekKey = getIsoWeekFromYmd(range.startDate)
    const loc = typeof route.query.location === 'string' ? route.query.location : locationId.value
    router.replace(`/weekly-reports/${weekKey}?location=${loc}`)
    return
  }
  refreshList()
})

function onLocationChange(e: Event) {
  setLocation((e.target as HTMLSelectElement).value)
}
</script>
