<template>
  <section class="space-y-6">
    <div v-if="categories?.length" class="grid gap-4 sm:grid-cols-2">
      <ChartsD3PieChartV2 :data="categoryPie" :width="320" :height="260" />
      <ul class="space-y-1 text-sm">
        <li v-for="c in categories" :key="c.name">
          {{ c.name }}: {{ formatEur(c.revenue) }} ({{ c.pctOfTotal }}%)
        </li>
      </ul>
    </div>

    <div v-if="hourlyCategoryStack?.points.length" class="rounded-lg border bg-white p-4">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold">Omzet per uur (keuken vs drank)</h2>
        <DailyOpsRevenueViewToggle :mode="stackMode" @update:mode="stackMode = $event" />
      </div>
      <ChartsD3StackedBarChart
        v-if="stackMode === 'chart'"
        :data="stackData"
        :keys="['keuken', 'dranken']"
        :colors="['#fbbf24', '#3b82f6']"
        :width="720"
        :height="280"
      />
      <table v-else class="text-sm">
        <thead>
          <tr class="text-xs text-gray-500">
            <th class="py-1">Uur</th>
            <th class="py-1 text-right">Keuken</th>
            <th class="py-1 text-right">Dranken</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in hourlyCategoryStack.points" :key="p.hour" class="border-t">
            <td class="py-1">{{ p.hour }}:00</td>
            <td class="py-1 text-right">{{ formatEur(p.keuken) }}</td>
            <td class="py-1 text-right">{{ formatEur(p.dranken) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="products?.length" class="overflow-x-auto rounded-lg border bg-white">
      <h2 class="px-4 pt-4 text-sm font-semibold">Top 20 producten</h2>
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th class="px-3 py-2">Product</th>
            <th class="px-3 py-2 text-right">Omzet</th>
            <th class="px-3 py-2 text-right">Stuks</th>
            <th class="px-3 py-2">Weekdagen (stuks)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.productName" class="border-t">
            <td class="px-3 py-2">{{ p.productName }}</td>
            <td class="px-3 py-2 text-right">{{ formatEur(p.revenue) }}</td>
            <td class="px-3 py-2 text-right">{{ p.itemsCount }}</td>
            <td class="px-3 py-2">
              <div v-if="p.byWeekday?.length" class="flex h-4 max-w-[140px] gap-px overflow-hidden rounded">
                <div
                  v-for="d in p.byWeekday"
                  :key="d.dayOfWeek"
                  class="min-w-[4px] flex-1 bg-emerald-400"
                  :style="{ opacity: weekdayOpacity(d.itemsCount, p.byWeekday) }"
                  :title="`${d.dayOfWeek}: ${d.itemsCount}`"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="hourlyMatrix?.rows.length" class="rounded-lg border bg-white p-4">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-sm font-semibold">Uur × weekdag</p>
        <DailyOpsRevenueViewToggle :mode="heatMode" @update:mode="heatMode = $event" />
      </div>
      <ChartsD3HeatmapChart
        v-if="heatMode === 'chart'"
        :rows="heatRows"
        :col-labels="dowLabels"
      />
      <table v-else class="border-collapse text-xs">
        <thead>
          <tr>
            <th class="border px-1">Uur</th>
            <th v-for="d in dowLabels" :key="d" class="border px-1">{{ d }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in hourlyMatrix.rows" :key="row.hour">
            <td class="border px-1 font-medium">{{ row.hour }}</td>
            <td
              v-for="(cell, ci) in row.weekdays"
              :key="ci"
              class="border px-1 text-right"
              :class="heatClass(cell.revenue)"
            >
              {{ cell.revenue > 0 ? formatEur(cell.revenue) : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="coOccurrence?.pairs.length" class="rounded-lg border bg-white p-4">
      <h2 class="mb-2 text-sm font-semibold">Productcombinaties</h2>
      <p v-if="coOccurrence.note" class="mb-2 text-xs text-gray-500">{{ coOccurrence.note }}</p>
      <table class="min-w-full text-sm">
        <thead class="text-left text-xs text-gray-500">
          <tr>
            <th class="py-1">Product A</th>
            <th class="py-1">Product B</th>
            <th class="py-1 text-right">Orders</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(pair, i) in coOccurrence.pairs" :key="i" class="border-t">
            <td class="py-1">{{ pair.productA }}</td>
            <td class="py-1">{{ pair.productB }}</td>
            <td class="py-1 text-right">{{ pair.count }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="coOccurrence?.note" class="text-sm text-gray-500">{{ coOccurrence.note }}</p>
  </section>
</template>

<script setup lang="ts">
import type {
  DailyOpsRevenueCategoryDto,
  DailyOpsRevenueCoOccurrenceDto,
  DailyOpsRevenueHourlyCategoryStackDto,
  DailyOpsRevenueHourlyMatrixDto,
  DailyOpsRevenueProductRow,
  DailyOpsRevenueProductWeekdaySlice,
} from '~/types/daily-ops-revenue'

const props = defineProps<{
  categories: DailyOpsRevenueCategoryDto[] | null
  products: DailyOpsRevenueProductRow[] | null
  hourlyMatrix: DailyOpsRevenueHourlyMatrixDto | null
  hourlyCategoryStack: DailyOpsRevenueHourlyCategoryStackDto | null
  coOccurrence: DailyOpsRevenueCoOccurrenceDto | null
}>()

const { formatEur } = useDashboardEurFormat()
const { mode: heatMode } = useDailyOpsRevenueViewMode('rev-heat-view', 'chart')
const { mode: stackMode } = useDailyOpsRevenueViewMode('rev-stack-view', 'chart')

const dowLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const categoryPie = computed(() =>
  (props.categories ?? []).slice(0, 8).map((c) => ({ label: c.name, value: c.revenue })),
)

const stackData = computed(() =>
  (props.hourlyCategoryStack?.points ?? []).map((p) => ({
    date: `${p.hour}:00`,
    keuken: p.keuken,
    dranken: p.dranken,
  })),
)

const heatRows = computed(() =>
  (props.hourlyMatrix?.rows ?? []).map((row) => ({
    label: `${row.hour}:00`,
    values: row.weekdays.map((c) => c.revenue),
  })),
)

function weekdayOpacity(
  count: number,
  slices: DailyOpsRevenueProductWeekdaySlice[],
): number {
  const max = Math.max(...slices.map((s) => s.itemsCount), 1)
  return 0.15 + (count / max) * 0.85
}

function heatClass(revenue: number): string {
  if (revenue <= 0) return 'bg-gray-50'
  if (revenue < 500) return 'bg-green-50'
  if (revenue < 1500) return 'bg-green-100'
  if (revenue < 3000) return 'bg-green-200'
  return 'bg-green-300'
}
</script>
