<template>
  <DailyOpsDashboardShell show-range-period-nav>
    <div class="min-w-0 space-y-8">
      <header class="space-y-2">
        <h1 class="text-[38px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
          Daily Ops / {{ locationTitle }} / {{ pageHeadingSuffix }}
        </h1>
        <p class="text-xl font-medium text-gray-700">
          {{ contextHeadline }}
        </p>
        <p v-if="summary?.vatDisclaimer" class="text-base italic text-gray-500">
          {{ summary.vatDisclaimer }}
        </p>
      </header>

      <DailyOpsKpiTiles
        :period="period"
        :anchor="anchor"
        :summary="summary"
      />

      <DailyOpsVenueStrip :period="period" :anchor="anchor" />

      <UAlert v-if="error" color="error" variant="soft" title="Could not load dashboard" :description="String(error)" />

      <div v-if="pending" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <USkeleton v-for="i in 4" :key="i" class="h-28 w-full rounded-lg" />
      </div>

      <template v-else-if="summary">

        <DailyOpsProductivitySummary
          v-if="isProductivityView"
          @select-team="selectTeam"
          @select-contract="selectContract"
        />

        <DailyOpsRevenueMetricsSection :period="period" />

        <DailyOpsProductivityLaborSection v-if="isProductivityView && labor" :labor="labor" />

        <p class="text-xs text-gray-400">
          Range: {{ summary.range.startDate }} → {{ summary.range.endDate }} ({{ summary.range.period }}) · Dashboard metrics
          load in parallel (summary, revenue, labor).
        </p>
      </template>

      <div
        v-else-if="!pending"
        class="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-700 shadow-sm"
      >
        <p class="font-semibold text-gray-900">Metrics did not load</p>
        <p class="mt-1 text-gray-600">
          Try a hard refresh. If the problem continues, check the browser network tab for failed requests to
          <span class="font-mono text-xs">/api/daily-ops/metrics/summary, revenue-breakdown, labor</span>.
        </p>
        <UButton type="button" class="mt-4" color="neutral" variant="outline" @click="() => void refreshMetrics()">
          Retry
        </UButton>
      </div>
    </div>

    <!-- Worker Details Drawer (productivity page only) -->
    <WorkerDetailsDrawer
      v-if="isProductivityView"
      :is-open="isDrawerOpen"
      :loading="drawerStaffPending"
      :selected-team="selectedTeam"
      :selected-contract="selectedContract"
      :workers-data="filteredWorkers"
      @close="closeDrawer"
    />
  </DailyOpsDashboardShell>
</template>

<script setup lang="ts">
import WorkerDetailsDrawer from '~/components/daily-ops/WorkerDetailsDrawer.vue'

const props = withDefaults(
  defineProps<{
    /** Last segment of the H1, e.g. Dashboard, Revenue, Productivity */
    pageHeadingSuffix?: string
    /** Labor detail tables/charts only on /daily-ops/productivity */
    variant?: 'dashboard' | 'productivity'
  }>(),
  {
    pageHeadingSuffix: 'Dashboard',
    variant: 'dashboard',
  }
)

const isProductivityView = computed(() => props.variant === 'productivity')

type LocationRow = { _id: string; name: string; abbreviation?: string }

const { dashboardQuery, contextHeadline, locationId, period, anchor } = useDailyOpsDashboardRoute()

const { data: locationsRes } = useFetch<{ success: boolean; data: LocationRow[] }>(
  '/api/daily-ops/locations',
  { key: 'daily-ops-locations' },
)

const locationTitle = computed(() => {
  if (!locationId.value) return 'All Locations'
  const rows = locationsRes.value?.data ?? []
  const hit = rows.find((row) => row._id === locationId.value)
  return hit?.name ?? 'Selected Location'
})

const { summary: summaryRef, revenue: revenueRef, labor: laborRef, pending, error, refresh: refreshMetrics } = useDailyOpsDashboardMetrics()
const summary = computed(() => summaryRef.value ?? null)
const revenue = computed(() => revenueRef.value ?? null)
const labor = computed(() => laborRef.value ?? null)

const {
  selectedTeam,
  selectedContract,
  isDrawerOpen,
  drawerStaffPending,
  filteredWorkers,
  selectTeam,
  selectContract,
  closeDrawer,
} = useDailyOpsWorkerDrawer(labor, dashboardQuery)
</script>
