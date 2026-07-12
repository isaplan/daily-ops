<template>
  <DailyOpsDashboardShell>
    <div class="space-y-6">
      <header>
        <h1 class="text-2xl font-bold text-gray-900">Weekly Report</h1>
        <p v-if="digestDto" class="text-sm text-gray-600">
          {{ digestDto.locationName }} · {{ digestDto.label }} · {{ digestDto.startDate }} → {{ digestDto.endDate }}
        </p>
      </header>

      <nav class="flex flex-wrap gap-1 border-b border-gray-200">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="border-b-2 px-4 py-2 text-sm font-semibold transition-colors"
          :class="activeTab === tab.id
            ? 'border-gray-900 text-gray-900'
            : 'border-transparent text-gray-500 hover:text-gray-800'"
          @click="setTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div v-if="pending" class="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Loading weekly report…
      </div>

      <template v-else-if="digestDto">
        <DailyOpsAnalyticsWeeklyOverviewTab
          v-if="activeTab === 'overview'"
          :digest="digestDto"
          :status-badge-class="statusBadgeClass"
          :status-label="statusLabel"
        />
        <DailyOpsAnalyticsWeeklyRevenueTab v-else-if="activeTab === 'revenue'" :digest="digestDto" />
        <DailyOpsAnalyticsWeeklyLaborTab v-else-if="activeTab === 'labor'" :digest="digestDto" />
        <DailyOpsAnalyticsWeeklyStaffTab v-else-if="activeTab === 'staff'" :digest="digestDto" />
        <DailyOpsAnalyticsWeeklyLossTab v-else-if="activeTab === 'loss'" :digest="digestDto" />
      </template>

      <div
        v-else
        class="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900"
      >
        No weekly report data for this period. Try another week or location.
      </div>
    </div>
  </DailyOpsDashboardShell>
</template>

<script setup lang="ts">
/**
 * @registry-id: dailyOpsWeeklyReportPage
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-07-09T00:00:00.000Z
 * @description: Weekly digest report page
 * @last-fix: [2026-07-09] Initial weekly report page
 * @adr-ref: ADR-004, ADR-013
 * @data-source: read-cache
 * @read-cache-json: weekly-digest (via composables/useDailyOpsWeeklyReport.ts)
 * @imports-data-from: composables/useDailyOpsWeeklyReport.ts
 */

import type { WeeklyReportTabId } from '~/composables/useDailyOpsWeeklyReport'

definePageMeta({ keepalive: false })

const {
  digest,
  pending,
  activeTab,
  setTab,
  statusBadgeClass,
  statusLabel,
} = useDailyOpsWeeklyReport()

/** Unwrap useFetch ref for child props (template unwrap does not always apply to :prop bindings). */
const digestDto = computed(() => unref(digest))

const tabs: { id: WeeklyReportTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'labor', label: 'Labor' },
  { id: 'staff', label: 'Staff ± / leave' },
  { id: 'loss', label: 'Loss & mix' },
]
</script>
