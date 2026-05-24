<template>
  <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-gray-900">Omzet per dag</h2>
      <DailyOpsRevenueViewToggle
        v-if="!pending && daysWithRevenue.length"
        :mode="viewMode"
        @update:mode="viewMode = $event"
      />
    </div>

    <div v-if="pending" class="space-y-2">
      <USkeleton class="h-[280px] w-full rounded-lg" />
    </div>

    <p v-else-if="!daysWithRevenue.length" class="text-sm text-gray-500">
      Geen dagomzet voor deze periode.
    </p>

    <template v-else>
      <ClientOnly>
        <ChartsD3StackedBarChart
          v-if="viewMode === 'chart'"
          :data="barData"
          :keys="['revenue']"
          :width="760"
          :height="280"
          :colors="['#111827']"
        />
      </ClientOnly>

      <div v-if="viewMode === 'table'" class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase text-gray-500">
              <th class="px-2 py-2">Datum</th>
              <th class="px-2 py-2 text-right">Omzet</th>
              <th class="px-2 py-2 text-right">Stuks</th>
              <th class="px-2 py-2 text-right">€ / stuk</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in daysWithRevenue"
              :key="row.date"
              class="border-t border-gray-100"
            >
              <td class="px-2 py-2">{{ row.date }}</td>
              <td class="px-2 py-2 text-right font-medium">{{ formatEur(row.revenue) }}</td>
              <td class="px-2 py-2 text-right">{{ row.itemsCount.toLocaleString('nl-NL') }}</td>
              <td class="px-2 py-2 text-right">{{ formatEur(row.revenuePerItem) }}</td>
            </tr>
          </tbody>
          <tfoot v-if="daysWithRevenue.length > 1">
            <tr class="border-t-2 border-gray-200 font-semibold">
              <td class="px-2 py-2">Totaal</td>
              <td class="px-2 py-2 text-right">{{ formatEur(totals.revenue) }}</td>
              <td class="px-2 py-2 text-right">{{ totals.itemsCount.toLocaleString('nl-NL') }}</td>
              <td class="px-2 py-2 text-right">{{ formatEur(totals.revenuePerItem) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { RevenueViewMode } from '~/composables/useDailyOpsRevenueViewMode'
import type { DailyOpsRevenueTimeseriesDto } from '~/types/daily-ops-revenue'

const props = defineProps<{
  timeseries: DailyOpsRevenueTimeseriesDto | null
  pending?: boolean
}>()

const { formatEur } = useDashboardEurFormat()
const viewMode = ref<RevenueViewMode>('chart')

const daysWithRevenue = computed(() => {
  const points = props.timeseries?.current ?? []
  return points
    .filter((p) => p.revenue > 0)
    .map((p) => ({
      ...p,
      revenuePerItem: p.itemsCount > 0 ? Math.round((p.revenue / p.itemsCount) * 100) / 100 : 0,
    }))
})

const barData = computed(() =>
  daysWithRevenue.value.map((p) => ({
    date: p.date,
    revenue: p.revenue,
  })),
)

const totals = computed(() => {
  const rows = daysWithRevenue.value
  const revenue = rows.reduce((s, r) => s + r.revenue, 0)
  const itemsCount = rows.reduce((s, r) => s + r.itemsCount, 0)
  return {
    revenue: Math.round(revenue * 100) / 100,
    itemsCount,
    revenuePerItem: itemsCount > 0 ? Math.round((revenue / itemsCount) * 100) / 100 : 0,
  }
})
</script>
