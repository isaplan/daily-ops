<template>
  <UCard
    v-if="detail && (detail.apiHourlyByCalendarHour.length > 0 || detail.inboxBasisCronSnapshots.length > 0)"
    class="border-2 border-gray-900 !bg-white ring-0 shadow-none"
  >
    <template #header>
      <h2 class="text-lg font-semibold text-gray-900">Today — hourly API &amp; inbox checkpoints</h2>
    </template>
    <p class="mb-4 text-xs text-gray-500">
      Hourly revenue from Bork aggregates for this calendar date (through latest sync). Basis Report rows at 15:00 and 23:00 (cron) are partial-day snapshots per venue — compare with API hourly rollups.
    </p>
    <div class="grid gap-6 lg:grid-cols-2">
      <div v-if="detail.apiHourlyByCalendarHour.length > 0">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Hourly · API (calendar hour)</p>
        <div class="max-h-56 overflow-y-auto rounded border border-gray-200">
          <table class="w-full text-left text-sm">
            <thead class="sticky top-0 bg-gray-50 text-xs text-gray-600">
              <tr>
                <th class="px-3 py-2">Hour</th>
                <th class="px-3 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in detail.apiHourlyByCalendarHour"
                :key="`th-${row.calendarHour}`"
                class="border-t border-gray-100"
              >
                <td class="px-3 py-1.5 tabular-nums">{{ String(row.calendarHour).padStart(2, '0') }}:00</td>
                <td class="px-3 py-1.5 text-right tabular-nums">{{ formatEur(row.revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-if="detail.inboxBasisCronSnapshots.length > 0">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Inbox Basis · 15:00 / 23:00</p>
        <ul class="space-y-2 text-sm">
          <li
            v-for="(snap, idx) in detail.inboxBasisCronSnapshots"
            :key="`cron-${idx}-${snap.locationLabel}-${snap.cronHour}`"
            class="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-100 px-3 py-2"
          >
            <span class="font-medium text-gray-800">{{ snap.locationLabel || '—' }}</span>
            <span class="text-xs text-gray-500">{{ snap.cronHour }}:00 batch</span>
            <span class="tabular-nums text-gray-900">{{ formatEur(snap.finalRevenueExVat) }} <span class="text-gray-500">ex VAT</span></span>
          </li>
        </ul>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { DailyOpsTodayRevenueDetailDto } from '~/types/daily-ops-dashboard'

defineProps<{
  detail?: DailyOpsTodayRevenueDetailDto | null
}>()

const { formatEur } = useDashboardEurFormat()
</script>
