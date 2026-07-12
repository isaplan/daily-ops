<template>
  <div class="rounded-lg border-2 border-gray-900 bg-white p-4">
    <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-sm font-semibold text-gray-900">Staff ± hours</h2>
        <p class="mt-0.5 text-xs text-gray-500">Worked vs contract · uren contract · last week</p>
      </div>
      <div class="flex flex-wrap gap-3 text-xs tabular-nums">
        <span class="font-semibold text-emerald-700">+{{ fmtHours(summary.plusHours) }}</span>
        <span class="font-semibold text-red-700">{{ fmtHours(summary.minusHours) }}</span>
        <span class="font-semibold" :class="summary.netDelta >= 0 ? 'text-emerald-700' : 'text-red-700'">
          Net {{ signedHours(summary.netDelta) }}
        </span>
      </div>
    </div>

    <div class="mb-4 grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        class="rounded-lg border-2 border-gray-900 bg-white p-3 text-left transition-colors hover:bg-gray-50"
        :class="expanded === 'over' ? 'ring-2 ring-gray-900/10' : ''"
        @click="toggle('over')"
      >
        <p class="text-xs font-semibold uppercase text-gray-500">Over +{{ summary.overThreshold }}h</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{{ summary.over.length }}</p>
        <p class="mt-0.5 text-xs text-gray-600">staff</p>
      </button>
      <button
        type="button"
        class="rounded-lg border-2 border-gray-900 bg-white p-3 text-left transition-colors hover:bg-gray-50"
        :class="expanded === 'under' ? 'ring-2 ring-gray-900/10' : ''"
        @click="toggle('under')"
      >
        <p class="text-xs font-semibold uppercase text-gray-500">Under {{ summary.underThreshold }}h</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-red-700">{{ summary.under.length }}</p>
        <p class="mt-0.5 text-xs text-gray-600">staff</p>
      </button>
    </div>

    <div v-if="expanded && expandedRows.length" class="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div class="mb-2 flex items-center justify-between gap-2">
        <h3 class="text-xs font-semibold text-gray-700">{{ expandedTitle }}</h3>
        <button type="button" class="text-xs font-medium text-gray-500 hover:text-gray-900" @click="expanded = null">
          Close
        </button>
      </div>
      <ul class="divide-y divide-gray-200">
        <li
          v-for="row in expandedRows"
          :key="row.memberId"
          class="flex items-center justify-between gap-3 py-2 text-sm"
        >
          <span class="font-semibold text-gray-900">{{ row.userName }}</span>
          <span class="tabular-nums" :class="row.weekDelta >= 0 ? 'text-emerald-700' : 'text-red-700'">
            {{ signedHours(row.weekDelta) }}
          </span>
        </li>
      </ul>
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
            <th class="py-2 pr-4">Name</th>
            <th v-if="showLocationColumn" class="py-2 pr-4">Location</th>
            <th class="py-2 pr-4">Team</th>
            <th class="py-2 text-right">Worked</th>
            <th class="py-2 text-right">Contract</th>
            <th class="py-2 text-right">± week</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in summary.members"
            :key="row.memberId"
            class="border-b border-gray-100"
          >
            <td class="py-2 pr-4 font-medium text-gray-900">{{ row.userName }}</td>
            <td v-if="showLocationColumn" class="py-2 pr-4 text-gray-600">{{ row.locationLabel || '—' }}</td>
            <td class="py-2 pr-4 text-gray-600">{{ row.teamName }}</td>
            <td class="py-2 text-right tabular-nums">{{ fmtHours(row.workedHours) }}</td>
            <td class="py-2 text-right tabular-nums">{{ fmtHours(row.contractHours) }}</td>
            <td
              class="py-2 text-right font-semibold tabular-nums"
              :class="row.weekDelta >= 0 ? 'text-emerald-700' : 'text-red-700'"
            >
              {{ signedHours(row.weekDelta) }}
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!summary.members.length" class="py-4 text-sm text-gray-600">No uren-contract staff for this week.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WeeklyStaffPlusminSummary } from '~/types/daily-ops-weekly-report'

const props = defineProps<{
  summary: WeeklyStaffPlusminSummary
  locationId?: string
}>()

const showLocationColumn = computed(() => (props.locationId ?? 'all') === 'all')

const expanded = ref<'over' | 'under' | null>(null)

function fmtHours(n: number): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function signedHours(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${fmtHours(n)}`
}

function toggle(kind: 'over' | 'under') {
  expanded.value = expanded.value === kind ? null : kind
}

const expandedRows = computed(() =>
  expanded.value === 'over' ? props.summary.over : expanded.value === 'under' ? props.summary.under : [],
)

const expandedTitle = computed(() =>
  expanded.value === 'over'
    ? `Over +${props.summary.overThreshold}h`
    : expanded.value === 'under'
      ? `Under ${props.summary.underThreshold}h`
      : '',
)
</script>
