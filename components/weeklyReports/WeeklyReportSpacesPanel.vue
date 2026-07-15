<template>
  <div v-if="digest" class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
    <p class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">Spaces</p>
    <table class="min-w-full text-sm">
      <thead class="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
        <tr>
          <th class="px-4 py-2 text-left">Space</th>
          <th class="px-4 py-2 text-right">Tables</th>
          <th class="px-4 py-2 text-right">Revenue</th>
          <th class="px-4 py-2 text-right">Est. labor</th>
          <th class="px-4 py-2 text-right">Margin</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in spaceRows" :key="row.locationSpace" class="border-b border-gray-100">
          <td class="px-4 py-2 font-medium">{{ row.locationSpace }}</td>
          <td class="px-4 py-2 text-right tabular-nums">{{ row.tableCount }}</td>
          <td class="px-4 py-2 text-right">{{ formatEur(row.revenue) }}</td>
          <td class="px-4 py-2 text-right">{{ formatEur(row.estimatedLaborCost) }}</td>
          <td class="px-4 py-2 text-right" :class="row.margin < 0 ? 'font-semibold text-red-600' : 'text-green-700'">
            {{ formatEur(row.margin) }}
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!spaceRows.length" class="px-4 py-6 text-sm text-gray-500">No space data for this week.</p>
  </div>
</template>

<script setup lang="ts">
import type { WeeklyDigestDto } from '~/types/daily-ops-weekly-report'

const props = defineProps<{ digest: WeeklyDigestDto | null }>()
const { formatEur } = useDashboardEurFormat()

type SpaceRow = {
  locationSpace: string
  tableCount: number
  revenue: number
  estimatedLaborCost: number
  margin: number
}

const spaceRows = computed((): SpaceRow[] => {
  const map = new Map<string, SpaceRow>()
  for (const row of props.digest?.spaceMargins ?? []) {
    const key = row.locationSpace || '—'
    const existing = map.get(key) ?? {
      locationSpace: key,
      tableCount: 0,
      revenue: 0,
      estimatedLaborCost: 0,
      margin: 0,
    }
    existing.tableCount += 1
    existing.revenue += row.revenue
    existing.estimatedLaborCost += row.estimatedLaborCost
    existing.margin += row.margin
    map.set(key, existing)
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
})
</script>
