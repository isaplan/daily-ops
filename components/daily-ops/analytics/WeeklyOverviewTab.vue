<template>
  <div v-if="digest" class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8">
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase text-gray-500">Revenue</p>
        <p class="text-2xl font-bold">{{ formatEur(digest.totals.revenue) }}</p>
        <p class="mt-1 text-xs text-gray-600">
          vs prev: {{ formatDelta(digest.comparisons.previousWeek.revenue) }}
        </p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-semibold uppercase text-gray-500">Labor %</p>
          <span class="rounded px-2 py-0.5 text-xs font-semibold" :class="statusBadgeClass(digest.totals.laborStatus)">
            {{ statusLabel(digest.totals.laborStatus) }}
          </span>
        </div>
        <p class="text-2xl font-bold">{{ pct(digest.totals.laborCostPct) }}</p>
        <p class="mt-1 text-xs text-gray-600">Target &lt; {{ digest.targets.laborGoodPct }}% good</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-semibold uppercase text-gray-500">P&amp;L %</p>
          <span class="rounded px-2 py-0.5 text-xs font-semibold" :class="statusBadgeClass(digest.totals.pnlStatus)">
            {{ statusLabel(digest.totals.pnlStatus) }}
          </span>
        </div>
        <p class="text-2xl font-bold">{{ pct(digest.totals.pnlPct) }}</p>
        <p class="mt-1 text-xs text-gray-600">Target ≥ {{ digest.targets.pnlTargetPct }}%</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase text-gray-500">€ / hour</p>
        <p class="text-2xl font-bold">{{ digest.totals.revenuePerHour != null ? formatEur(digest.totals.revenuePerHour) : '—' }}</p>
        <p class="mt-1 text-xs text-gray-600">{{ digest.totals.laborHours.toLocaleString('nl-NL') }} hours</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase text-gray-500">Staff</p>
        <p class="text-2xl font-bold">{{ digest.totals.staffCount }}</p>
        <p class="mt-1 text-xs text-gray-600">{{ digest.totals.itemsCount.toLocaleString('nl-NL') }} items</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase text-gray-500">Ziek</p>
        <p class="text-2xl font-bold tabular-nums">{{ fmtHours(digest.attendance.ziekHours) }}</p>
        <p class="mt-1 text-xs text-gray-600">{{ digest.attendance.ziekStaffCount }} staff</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase text-gray-500">Verlof</p>
        <p class="text-2xl font-bold tabular-nums">{{ digest.attendance.verlofStaffCount }}</p>
        <p class="mt-1 text-xs text-gray-600">
          {{ digest.attendance.verlofHours > 0 ? `${fmtHours(digest.attendance.verlofHours)} hours` : 'staff on leave' }}
        </p>
      </div>
      <div
        v-if="digest.openingClosing"
        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <p class="text-xs font-semibold uppercase text-gray-500">Open &amp; close</p>
        <p class="text-2xl font-bold tabular-nums">{{ fmtHours(digest.openingClosing.outsideHours) }}</p>
        <p class="mt-1 text-xs text-gray-600">
          ↑{{ fmtHours(digest.openingClosing.preOpenHours) }} · ↓{{ fmtHours(digest.openingClosing.postCloseHours) }}
        </p>
        <p class="mt-0.5 text-xs text-gray-500">
          Keuk {{ fmtHours(digest.openingClosing.keuken.outsideHours) }} · Bed {{ fmtHours(digest.openingClosing.bediening.outsideHours) }}
        </p>
      </div>
    </div>

    <DailyOpsAnalyticsWeeklyDailyRevenueChart
      :daily-breakdown="digest.dailyBreakdown"
      :comparisons="digest.comparisons"
    />

    <DailyOpsAnalyticsWeeklyStaffPlusminSection
      v-if="digest.staffPlusmin && !hideStaffPlusmin"
      :summary="digest.staffPlusmin"
      :location-id="digest.locationId"
    />

    <p v-if="digest.dataGap" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Incomplete snapshot coverage ({{ digest.coverage.daysFound }}/{{ digest.coverage.daysExpected }} days).
    </p>
  </div>
</template>

<script setup lang="ts">
import type { WeeklyCompareMetric, WeeklyDigestDto } from '~/types/daily-ops-weekly-report'

defineProps<{
  digest: WeeklyDigestDto | null
  statusBadgeClass: (s: WeeklyDigestDto['totals']['laborStatus']) => string
  statusLabel: (s: WeeklyDigestDto['totals']['laborStatus']) => string
  /** Weekly report KPI section shows plusmin under Staff General instead */
  hideStaffPlusmin?: boolean
}>()

const { formatEur } = useDashboardEurFormat()

function pct(v: number | null): string {
  return v != null ? `${v}%` : '—'
}

function fmtHours(n: number): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function formatDelta(metric: WeeklyCompareMetric): string {
  const sign = metric.delta >= 0 ? '+' : ''
  const pctPart = metric.pct != null ? ` (${sign}${metric.pct}%)` : ''
  return `${sign}${formatEur(metric.delta)}${pctPart}`
}
</script>
