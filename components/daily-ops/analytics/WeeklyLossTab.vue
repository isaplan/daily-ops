<template>
  <div v-if="digest" class="space-y-6">
    <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p class="mb-3 text-sm font-semibold text-gray-900">Hourly margin heatmap (revenue − labor)</p>
      <div class="overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead>
            <tr>
              <th class="px-2 py-1 text-left">Day</th>
              <th v-for="h in activeHours" :key="h" class="px-1 py-1 text-center">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="day in digest.dailyBreakdown" :key="`hm-${day.businessDate}`">
              <td class="px-2 py-1 font-medium">{{ day.dayOfWeek }}</td>
              <td
                v-for="h in activeHours"
                :key="`${day.businessDate}-${h}`"
                class="px-1 py-1 text-center"
                :class="cellClass(day.businessDate, h)"
                :title="cellTitle(day.businessDate, h)"
              >
                {{ cellSymbol(day.businessDate, h) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-gray-500">■ loss · ▲ thin margin · ● positive</p>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <p class="border-b border-gray-200 px-4 py-3 text-sm font-semibold">Category recovery</p>
        <table class="min-w-full text-sm">
          <thead class="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th class="px-4 py-2 text-left">Category</th>
              <th class="px-4 py-2 text-right">Revenue</th>
              <th class="px-4 py-2 text-right">COGS</th>
              <th class="px-4 py-2 text-right">Labor</th>
              <th class="px-4 py-2 text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cat in digest.categoryMargins" :key="cat.key" class="border-b border-gray-100">
              <td class="px-4 py-2 font-medium">{{ cat.label }}</td>
              <td class="px-4 py-2 text-right">{{ formatEur(cat.revenue) }}</td>
              <td class="px-4 py-2 text-right">{{ formatEur(cat.cogs) }}</td>
              <td class="px-4 py-2 text-right">{{ formatEur(cat.allocatedLabor) }}</td>
              <td class="px-4 py-2 text-right" :class="cat.margin < 0 ? 'text-red-600 font-semibold' : 'text-green-700'">
                {{ formatEur(cat.margin) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <p class="border-b border-gray-200 px-4 py-3 text-sm font-semibold">Upsell (water · beer · lemonade)</p>
        <table class="min-w-full text-sm">
          <tbody>
            <tr v-for="u in digest.upsell" :key="u.key" class="border-b border-gray-100">
              <td class="px-4 py-2 font-medium">{{ u.label }}</td>
              <td class="px-4 py-2 text-right">{{ u.quantity }}</td>
              <td class="px-4 py-2 text-right">{{ formatEur(u.revenue) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="!hideTables" class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <p class="border-b border-gray-200 px-4 py-3 text-sm font-semibold">Top spaces / tables</p>
      <table class="min-w-full text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th class="px-4 py-2 text-left">Table</th>
            <th class="px-4 py-2 text-left">Space</th>
            <th class="px-4 py-2 text-right">Revenue</th>
            <th class="px-4 py-2 text-right">Est. labor</th>
            <th class="px-4 py-2 text-right">Margin</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in digest.spaceMargins.slice(0, 15)" :key="`${s.tableNum}-${s.locationSpace}`" class="border-b border-gray-100">
            <td class="px-4 py-2">{{ s.tableNum }}</td>
            <td class="px-4 py-2">{{ s.locationSpace }}</td>
            <td class="px-4 py-2 text-right">{{ formatEur(s.revenue) }}</td>
            <td class="px-4 py-2 text-right">{{ formatEur(s.estimatedLaborCost) }}</td>
            <td class="px-4 py-2 text-right" :class="s.margin < 0 ? 'text-red-600' : ''">{{ formatEur(s.margin) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WeeklyDigestDto } from '~/types/daily-ops-weekly-report'

const props = defineProps<{ digest: WeeklyDigestDto | null; hideTables?: boolean }>()
const { formatEur } = useDashboardEurFormat()

const activeHours = ['10', '12', '14', '16', '18', '20', '22']

const cellMap = computed(() => {
  const map = new Map<string, { margin: number; status: string }>()
  for (const c of props.digest?.hourlyLoss ?? []) {
    const hour = c.hourLabel.slice(0, 2)
    map.set(`${c.businessDate}|${hour}`, { margin: c.margin, status: c.status })
  }
  return map
})

function cellClass(date: string, hour: string): string {
  const hit = cellMap.value.get(`${date}|${hour}`)
  if (!hit) return 'text-gray-300'
  if (hit.status === 'bad') return 'bg-red-100 text-red-800'
  if (hit.status === 'okay') return 'bg-amber-100 text-amber-800'
  return 'bg-green-100 text-green-800'
}

function cellSymbol(date: string, hour: string): string {
  const hit = cellMap.value.get(`${date}|${hour}`)
  if (!hit) return '·'
  if (hit.status === 'bad') return '■'
  if (hit.status === 'okay') return '▲'
  return '●'
}

function cellTitle(date: string, hour: string): string {
  const hit = cellMap.value.get(`${date}|${hour}`)
  return hit ? `Margin ${formatEur(hit.margin)}` : 'No data'
}
</script>
