<template>
  <div class="space-y-6 p-4 md:p-6">
    <header>
      <h1 class="text-2xl font-bold text-gray-900">All Reports</h1>
      <p class="text-sm text-gray-600">Weekly and monthly sealed reports, chronological.</p>
    </header>

    <div class="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div class="flex flex-wrap items-end gap-4">
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Type</p>
          <UiPillTabs
            v-model="typeFilter"
            :options="typeOptions"
            aria-label="Report type"
          />
        </div>

        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Year</p>
          <USelectMenu
            v-model="selectedYear"
            :items="yearOptions"
            value-attribute="value"
            class="min-w-32"
          />
        </div>
      </div>

      <div class="space-y-2 border-t border-gray-100 pt-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Locations</p>
        <div class="inline-flex flex-wrap gap-1">
          <button
            v-for="venue in venuePillOptions"
            :key="venue.value"
            type="button"
            class="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors"
            :class="activeLocationIds.has(venue.value)
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900'"
            :aria-pressed="activeLocationIds.has(venue.value)"
            @click="toggleLocation(venue.value)"
          >
            {{ venue.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="pending" class="text-sm text-gray-500">Loading reports…</div>

    <ul v-else class="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
      <li v-for="item in filtered" :key="`${item.type}-${item.periodKey}-${item.locationId}`">
        <NuxtLink
          :to="item.href"
          class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                :class="item.type === 'weekly'
                  ? 'bg-sky-50 text-sky-800'
                  : 'bg-violet-50 text-violet-800'"
              >
                {{ item.type }}
              </span>
              <p class="font-semibold text-gray-900">{{ item.label }}</p>
            </div>
            <p class="text-xs text-gray-500">
              {{ item.locationName }} · {{ item.startDate }} → {{ item.endDate }}
            </p>
          </div>
          <span
            v-if="item.frozenAt"
            class="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
          >
            Locked
          </span>
        </NuxtLink>
      </li>
      <li v-if="!filtered.length" class="px-4 py-8 text-center text-sm text-gray-500">
        No reports match these filters.
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: weeklyReportsAllPage
 * @created: 2026-07-17T00:00:00.000Z
 * @last-modified: 2026-07-17T00:00:00.000Z
 * @description: All weekly + monthly reports with type/year/location filters
 * @last-fix: [2026-07-17] Initial all-reports list page
 * @adr-ref: ADR-015
 */

import type { MonthlyReportListItem } from '~/types/monthlyReportDocument'
import type { WeeklyReportListItem } from '~/types/weeklyReportDocument'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'

definePageMeta({ keepalive: false })

type ReportTypeFilter = 'all' | 'weekly' | 'monthly'

type MergedReportItem = {
  type: 'weekly' | 'monthly'
  periodKey: string
  locationId: string
  locationName: string
  label: string
  startDate: string
  endDate: string
  frozenAt: string | null
  href: string
  year: number
}

const route = useRoute()
const router = useRouter()

const ALL_LOCATION_IDS = DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => v.locationId)

const typeFilter = ref<ReportTypeFilter>(
  route.query.type === 'weekly' || route.query.type === 'monthly' ? route.query.type : 'all',
)

const selectedYear = ref<number | 'all'>('all')

const activeLocationIds = ref<Set<string>>(
  (() => {
    const loc = typeof route.query.location === 'string' ? route.query.location : ''
    if (loc && ALL_LOCATION_IDS.includes(loc)) return new Set([loc])
    return new Set(ALL_LOCATION_IDS)
  })(),
)

const venuePillOptions = DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => ({
  value: v.locationId,
  label: v.short,
}))

const typeOptions = [
  { value: 'all' as const, label: 'All' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
]

const { data: weeklyRes, pending: weeklyPending } = useFetch<{ success: boolean; data: WeeklyReportListItem[] }>(
  '/api/weekly-reports?limit=104',
  { key: 'all-weekly-reports' },
)

const { data: monthlyRes, pending: monthlyPending } = useFetch<{ success: boolean; data: MonthlyReportListItem[] }>(
  '/api/monthly-reports?limit=72',
  { key: 'all-monthly-reports' },
)

const pending = computed(() => weeklyPending.value || monthlyPending.value)

const merged = computed((): MergedReportItem[] => {
  const weekly = (weeklyRes.value?.data ?? []).map((item): MergedReportItem => ({
    type: 'weekly',
    periodKey: item.weekKey,
    locationId: item.locationId,
    locationName: item.locationName,
    label: item.label,
    startDate: item.startDate,
    endDate: item.endDate,
    frozenAt: item.frozenAt,
    href: `/weekly-reports/${item.weekKey}?location=${item.locationId}`,
    year: Number(item.startDate.slice(0, 4)) || Number(item.weekKey.slice(0, 4)) || 0,
  }))
  const monthly = (monthlyRes.value?.data ?? []).map((item): MergedReportItem => ({
    type: 'monthly',
    periodKey: item.monthKey,
    locationId: item.locationId,
    locationName: item.locationName,
    label: item.label,
    startDate: item.startDate,
    endDate: item.endDate,
    frozenAt: item.frozenAt,
    href: `/weekly-reports/month/${item.monthKey}?location=${item.locationId}`,
    year: Number(item.monthKey.slice(0, 4)) || 0,
  }))
  return [...weekly, ...monthly].sort((a, b) => b.startDate.localeCompare(a.startDate))
})

const yearOptions = computed(() => {
  const years = [...new Set(merged.value.map((i) => i.year).filter((y) => y > 0))].sort((a, b) => b - a)
  return [
    { label: 'All years', value: 'all' as const },
    ...years.map((year) => ({ label: String(year), value: year })),
  ]
})

watch(typeFilter, (next) => {
  router.replace({
    path: route.path,
    query: {
      ...route.query,
      type: next === 'all' ? undefined : next,
    },
  })
})

function toggleLocation(id: string) {
  const next = new Set(activeLocationIds.value)
  if (next.has(id)) {
    if (next.size <= 1) return
    next.delete(id)
  } else {
    next.add(id)
  }
  activeLocationIds.value = next
}

function normalizeYear(raw: unknown): number | 'all' {
  if (raw === 'all') return 'all'
  if (typeof raw === 'object' && raw && 'value' in raw) {
    return normalizeYear((raw as { value: unknown }).value)
  }
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 'all'
}

watch(selectedYear, (raw) => {
  selectedYear.value = normalizeYear(raw)
})

const filtered = computed(() => {
  const year = normalizeYear(selectedYear.value)
  return merged.value.filter((item) => {
    if (typeFilter.value !== 'all' && item.type !== typeFilter.value) return false
    if (year !== 'all' && item.year !== year) return false
    if (!activeLocationIds.value.has(item.locationId)) return false
    return true
  })
})
</script>
