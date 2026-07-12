<template>
  <div v-if="digest" class="space-y-6">
    <DailyOpsAnalyticsWeeklyStaffPlusminSection
      v-if="digest.staffPlusmin"
      :summary="digest.staffPlusmin"
      :location-id="digest.locationId"
    />

    <div class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
        <h2 class="text-sm font-semibold text-gray-900">Ziek · last week</h2>
        <p class="mt-0.5 text-xs text-gray-500">
          {{ digest.attendance.ziekStaffCount }} staff · {{ fmtHours(digest.attendance.ziekHours) }} registered (Eitje uren)
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
        <h2 class="text-sm font-semibold text-gray-900">Verlof &amp; vakantie · last week</h2>
        <p class="mt-0.5 text-xs text-gray-500">
          {{ digest.attendance.verlofStaffCount }} staff · {{ fmtHours(digest.attendance.verlofHours) }} registered (Eitje uren)
        </p>
        <ul v-if="digest.attendance.verlofStaff.length" class="mt-3 divide-y divide-gray-100">
          <li
            v-for="row in digest.attendance.verlofStaff"
            :key="row.userId"
            class="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <div class="min-w-0">
              <p class="font-medium text-gray-900">{{ row.userName }}</p>
              <p v-if="row.teamName && row.teamName !== '—'" class="truncate text-xs text-gray-500">
                {{ row.teamName }}
              </p>
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

function fmtHours(n: number): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
</script>
