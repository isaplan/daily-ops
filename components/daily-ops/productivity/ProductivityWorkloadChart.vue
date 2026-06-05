<template>
  <div class="rounded-lg border border-gray-200 bg-white p-4">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="mb-0 text-lg font-semibold">Werkdruk per uur</h2>
      <DailyOpsRevenueViewToggle :mode="mode" @update:mode="mode = $event" />
    </div>
    <DailyOpsChartExpandShell
      v-if="mode === 'chart' && points.length"
      title="Werkdruk per uur"
      expand-aria-label="Expand workload chart"
    >
      <template #default="{ width, height }">
        <ChartsD3LineChart
          :series="series"
          :width="width"
          :height="Math.max(240, Math.round(height))"
        />
      </template>
    </DailyOpsChartExpandShell>
    <table v-else-if="points.length" class="min-w-full text-sm">
      <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
        <tr>
          <th class="px-3 py-2">Uur</th>
          <th class="px-3 py-2 text-right">Orders</th>
          <th class="px-3 py-2 text-right">Betalingen</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in points" :key="p.hour" class="border-t">
          <td class="px-3 py-2">{{ p.hour }}:00</td>
          <td class="px-3 py-2 text-right">{{ p.orderCount }}</td>
          <td class="px-3 py-2 text-right">{{ p.paymentCount }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { D3LineSeries } from '~/components/charts/D3LineChart.vue'
import type { DailyOpsOrderPaymentRhythmPoint } from '~/types/daily-ops-revenue'

const props = defineProps<{ points: DailyOpsOrderPaymentRhythmPoint[] }>()
const { mode } = useDailyOpsRevenueViewMode('prod-rhythm-view', 'chart')

const series = computed((): D3LineSeries[] => [
  {
    id: 'orders',
    label: 'Orders',
    color: '#111827',
    points: props.points.map((p) => ({ date: `${p.hour}`, value: p.orderCount })),
  },
  {
    id: 'payments',
    label: 'Betalingen',
    color: '#2563eb',
    dashed: true,
    points: props.points.map((p) => ({ date: `${p.hour}`, value: p.paymentCount })),
  },
])
</script>
