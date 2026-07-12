<template>
  <div v-if="digest" class="space-y-6">
    <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table class="min-w-full text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th class="px-4 py-3">Day</th>
            <th class="px-4 py-3 text-right">Hours</th>
            <th class="px-4 py-3 text-right">Labor cost</th>
            <th class="px-4 py-3 text-right">Labor %</th>
            <th class="px-4 py-3 text-right">Margin</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in digest.dailyBreakdown" :key="row.businessDate" class="border-b border-gray-100">
            <td class="px-4 py-2 font-medium">{{ row.dayOfWeek }}</td>
            <td class="px-4 py-2 text-right">{{ row.laborHours.toLocaleString('nl-NL') }}</td>
            <td class="px-4 py-2 text-right">{{ formatEur(row.laborCost) }}</td>
            <td class="px-4 py-2 text-right" :class="laborClass(row.laborCostPct)">
              {{ row.laborCostPct != null ? `${row.laborCostPct}%` : '—' }}
            </td>
            <td class="px-4 py-2 text-right">{{ formatEur(row.margin) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <p class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">By team</p>
      <table class="min-w-full text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th class="px-4 py-3">Team</th>
            <th class="px-4 py-3 text-right">Hours</th>
            <th class="px-4 py-3 text-right">Cost</th>
            <th class="px-4 py-3 text-right">% of revenue</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="team in digest.teams" :key="team.key" class="border-b border-gray-100">
            <td class="px-4 py-2 font-medium">{{ team.label }}</td>
            <td class="px-4 py-2 text-right">{{ team.hours.toLocaleString('nl-NL') }}</td>
            <td class="px-4 py-2 text-right">{{ formatEur(team.loadedCost) }}</td>
            <td class="px-4 py-2 text-right">{{ team.laborCostPct != null ? `${team.laborCostPct}%` : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p class="text-sm font-semibold text-gray-900">Labor % benchmarks</p>
      <ul class="mt-2 space-y-1 text-sm text-gray-700">
        <li>3-week avg: {{ pct(digest.comparisons.rolling3Week.avgLaborCostPct) }}</li>
        <li>6-week avg: {{ pct(digest.comparisons.rolling6Week.avgLaborCostPct) }}</li>
        <li>Targets: &lt;{{ digest.targets.laborGoodPct }}% good · ≤{{ digest.targets.laborOkayPct }}% okay · &gt;{{ digest.targets.laborOkayPct }}% bad</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WeeklyDigestDto } from '~/types/daily-ops-weekly-report'

defineProps<{ digest: WeeklyDigestDto | null }>()
const { formatEur } = useDashboardEurFormat()

function laborClass(pct: number | null): string {
  if (pct == null) return ''
  if (pct > 35) return 'font-semibold text-red-600'
  if (pct > 30) return 'text-amber-700'
  return 'text-green-700'
}

function pct(v: number | null): string {
  return v != null ? `${v}%` : '—'
}
</script>
