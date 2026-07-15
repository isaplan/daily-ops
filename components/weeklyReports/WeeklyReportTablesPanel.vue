<template>
  <div v-if="digest" class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
    <p class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">Tables</p>
    <table class="min-w-full text-sm">
      <thead class="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
        <tr>
          <th class="px-4 py-2 text-left">Table</th>
          <th class="px-4 py-2 text-left">Space</th>
          <th class="px-4 py-2 text-right">Revenue</th>
          <th class="px-4 py-2 text-right">Items</th>
          <th class="px-4 py-2 text-right">Est. labor</th>
          <th class="px-4 py-2 text-right">Margin</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in tableRows"
          :key="`${row.tableNum}-${row.locationSpace}`"
          class="border-b border-gray-100"
        >
          <td class="px-4 py-2 font-medium">{{ row.tableNum }}</td>
          <td class="px-4 py-2 text-gray-600">{{ row.locationSpace }}</td>
          <td class="px-4 py-2 text-right">{{ formatEur(row.revenue) }}</td>
          <td class="px-4 py-2 text-right tabular-nums">{{ row.quantity }}</td>
          <td class="px-4 py-2 text-right">{{ formatEur(row.estimatedLaborCost) }}</td>
          <td class="px-4 py-2 text-right" :class="row.margin < 0 ? 'font-semibold text-red-600' : 'text-green-700'">
            {{ formatEur(row.margin) }}
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!tableRows.length" class="px-4 py-6 text-sm text-gray-500">No table data for this week.</p>
  </div>
</template>

<script setup lang="ts">
import type { WeeklyDigestDto, WeeklySpaceMargin } from '~/types/daily-ops-weekly-report'

const props = defineProps<{ digest: WeeklyDigestDto | null }>()
const { formatEur } = useDashboardEurFormat()

const tableRows = computed((): WeeklySpaceMargin[] => {
  const rows = [...(props.digest?.spaceMargins ?? [])]
  rows.sort((a, b) => {
    const tableCmp = a.tableNum.localeCompare(b.tableNum, undefined, { numeric: true })
    if (tableCmp !== 0) return tableCmp
    return b.revenue - a.revenue
  })
  return rows
})
</script>
