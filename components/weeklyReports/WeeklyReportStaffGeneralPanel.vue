<template>
  <div v-if="digest" class="space-y-6">
    <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <p class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">Staff per day</p>
      <table class="min-w-full text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th class="px-4 py-2">Day</th>
            <th class="px-4 py-2 text-right">Staff</th>
            <th class="px-4 py-2 text-right">Hours worked</th>
            <th class="px-4 py-2 text-right">Productivity</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in digest.dailyBreakdown" :key="row.businessDate" class="border-b border-gray-100">
            <td class="px-4 py-2 font-medium">
              {{ row.dayOfWeek }} <span class="text-gray-500">{{ row.businessDate }}</span>
            </td>
            <td class="px-4 py-2 text-right tabular-nums">{{ row.staffCount }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ fmtHours(row.laborHours) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">
              {{ row.productivity != null ? formatEur(row.productivity) : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <p class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">Teams</p>
      <table class="min-w-full text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th class="px-4 py-2">Team</th>
            <th class="px-4 py-2 text-right">Hours</th>
            <th class="px-4 py-2 text-right">Cost</th>
            <th class="px-4 py-2 text-right">% of revenue</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="team in digest.teams" :key="team.key" class="border-b border-gray-100">
            <td class="px-4 py-2 font-medium">{{ team.label }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ team.hours.toLocaleString('nl-NL') }}</td>
            <td class="px-4 py-2 text-right">{{ formatEur(team.loadedCost) }}</td>
            <td class="px-4 py-2 text-right">{{ team.laborCostPct != null ? `${team.laborCostPct}%` : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <DailyOpsAnalyticsWeeklyStaffPlusminSection
      v-if="digest.staffPlusmin"
      :summary="digest.staffPlusmin"
      :location-id="digest.locationId"
    />

    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
        <h3 class="text-sm font-semibold text-gray-900">Ziek · last week</h3>
        <p class="mt-0.5 text-xs text-gray-500">
          {{ digest.attendance.ziekStaffCount }} staff · {{ fmtHours(digest.attendance.ziekHours) }} registered
        </p>
        <ul v-if="digest.attendance.ziekStaff.length" class="mt-3 divide-y divide-gray-100">
          <li
            v-for="row in digest.attendance.ziekStaff"
            :key="row.userId"
            class="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <span class="font-medium text-gray-900">{{ row.userName }}</span>
            <span class="tabular-nums text-gray-700">{{ fmtHours(row.hours) }}</span>
          </li>
        </ul>
        <p v-else class="mt-3 text-sm text-gray-600">No sick hours this week.</p>
      </div>

      <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
        <h3 class="text-sm font-semibold text-gray-900">Verlof &amp; vakantie · last week</h3>
        <p class="mt-0.5 text-xs text-gray-500">
          {{ digest.attendance.verlofStaffCount }} staff · {{ fmtHours(digest.attendance.verlofHours) }} registered
        </p>
        <ul v-if="digest.attendance.verlofStaff.length" class="mt-3 divide-y divide-gray-100">
          <li
            v-for="row in digest.attendance.verlofStaff"
            :key="row.userId"
            class="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <div class="min-w-0">
              <p class="font-medium text-gray-900">{{ row.userName }}</p>
              <p v-if="row.teamName && row.teamName !== '—'" class="truncate text-xs text-gray-500">{{ row.teamName }}</p>
            </div>
            <span v-if="row.hours > 0" class="shrink-0 tabular-nums text-gray-700">{{ fmtHours(row.hours) }}</span>
          </li>
        </ul>
        <p v-else class="mt-3 text-sm text-gray-600">No leave this week.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WeeklyDigestDto } from '~/types/daily-ops-weekly-report'

defineProps<{ digest: WeeklyDigestDto | null }>()
const { formatEur } = useDashboardEurFormat()

function fmtHours(n: number): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
</script>
