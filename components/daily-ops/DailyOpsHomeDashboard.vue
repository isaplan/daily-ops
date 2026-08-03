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
        :table-occupancy="tableOccupancy"
      />

      <DailyOpsVenueStrip
        :period="period"
        :anchor="anchor"
        :period-breakdown="periodBreakdown"
        :table-occupancy="tableOccupancy"
      />

      <UAlert
        v-if="snapshotCoverageAlert"
        color="warning"
        variant="soft"
        title="Partial period — incomplete data"
        :description="snapshotCoverageAlert"
      />

      <UAlert v-if="error" color="error" variant="soft" title="Could not load dashboard" :description="String(error)" />

      <!-- P&L / daypart deferred async so d3 doesn't block initial paint -->
      <Suspense>
        <DailyOpsRevenueMetricsSection
          :period="period"
          :revenue="revenue"
          :table-occupancy="tableOccupancy"
          :pending="pending && !revenue"
          @refresh="() => void refreshMetrics()"
        />
        <template #fallback>
          <div class="h-48 animate-pulse rounded-lg bg-gray-100" />
        </template>
      </Suspense>

      <DailyOpsProductivitySummary
        v-if="isProductivityView && summary"
        @select-team="selectTeam"
        @select-contract="selectContract"
      />

      <DailyOpsProductivityLaborSection v-if="isProductivityView && labor" :labor="labor" />

      <p v-if="summary" class="text-xs text-gray-400">
        Range: {{ summary.range.startDate }} → {{ summary.range.endDate }} ({{ summary.range.period }}) · Dashboard metrics
        load in parallel (summary, revenue, labor).
      </p>
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
/**
 * @description: Home dashboard — KPI, venue strip, revenue + labor sections
 * @last-modified: 2026-07-22T00:00:00.000Z
 * @last-fix: [2026-07-22] Wire sealed tableOccupancy + Bezettingsgraad chart section
 *   Prior: [2026-07-16] Always mount revenue/P&L below strip — was hidden when pending stuck
 *   Prior: [2026-07-16] Pass bundle revenue into metrics section (single metrics instance)
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: dashboard-bundle (via GET /api/daily-ops/metrics/bundle)
 * @imports-data-from: composables/useDailyOpsDashboardMetrics.ts
 */

import WorkerDetailsDrawer from '~/components/daily-ops/WorkerDetailsDrawer.vue'
// Defer d3-heavy revenue metrics section — loads after initial paint
const DailyOpsRevenueMetricsSection = defineAsyncComponent(
  () => import('~/components/daily-ops/DailyOpsRevenueMetricsSection.vue'),
)

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

const { summary: summaryRef, revenue: revenueRef, labor: laborRef, periodBreakdown: periodBreakdownRef, tableOccupancy: tableOccupancyRef, pending, error, refresh: refreshMetrics } = useDailyOpsDashboardMetrics()
const summary = computed(() => summaryRef.value ?? null)
const revenue = computed(() => revenueRef.value ?? null)
const labor = computed(() => laborRef.value ?? null)
const periodBreakdown = computed(() => periodBreakdownRef.value ?? null)
const tableOccupancy = computed(() => tableOccupancyRef.value ?? null)

const snapshotCoverageAlert = computed(() => {
  const cov = summary.value?.snapshotCoverage
  if (!cov?.missingDates?.length) return null
  const preview = cov.missingDates.slice(0, 8).join(', ')
  const more = cov.missingDates.length > 8 ? ` (+${cov.missingDates.length - 8} more)` : ''
  return `${cov.daysFound}/${cov.daysExpected} days loaded. Missing: ${preview}${more}. Run pnpm snapshots:backfill:gaps to fix.`
})

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
