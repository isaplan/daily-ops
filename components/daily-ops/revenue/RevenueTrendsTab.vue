<template>
  <section class="space-y-6">
    <div v-if="rollingMedians" class="grid gap-4 sm:grid-cols-3">
      <div
        v-for="w in rollingMedians.windows"
        :key="w.label"
        class="rounded-lg border border-gray-200 bg-white p-4"
      >
        <p class="text-xs font-semibold uppercase text-gray-500">{{ w.label }} mediaan</p>
        <p class="text-xl font-bold">{{ formatEur(w.median) }}</p>
        <p class="text-xs text-gray-500">μ {{ formatEur(w.mean) }} · P25 {{ formatEur(w.p25) }}</p>
      </div>
    </div>

    <div v-if="timeseries?.current.length" class="rounded-lg border border-gray-200 bg-white p-4">
      <div class="mb-3 flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold">Omzet ({{ timeseries.granularity }})</h2>
        <DailyOpsRevenueViewToggle :mode="tsMode" @update:mode="tsMode = $event" />
      </div>
      <ChartsD3LineChart v-if="tsMode === 'chart'" :series="tsSeries" :width="760" :height="300" />
      <table v-else class="min-w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-gray-500">
            <th class="py-1">Periode</th>
            <th class="py-1 text-right">Omzet</th>
            <th class="py-1 text-right">Stuks</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in timeseries.current" :key="p.date" class="border-t">
            <td class="py-1">{{ p.date }}</td>
            <td class="py-1 text-right">{{ formatEur(p.revenue) }}</td>
            <td class="py-1 text-right">{{ p.itemsCount }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="rounded-lg border border-gray-200 bg-white p-4">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <label class="text-sm font-medium">Weekdag</label>
        <select v-model="weekdayPick" class="rounded border px-2 py-1 text-sm">
          <option value="monday">Maandag</option>
          <option value="tuesday">Dinsdag</option>
          <option value="wednesday">Woensdag</option>
          <option value="thursday">Donderdag</option>
          <option value="friday">Vrijdag</option>
          <option value="saturday">Zaterdag</option>
          <option value="sunday">Zondag</option>
        </select>
        <DailyOpsRevenueViewToggle :mode="wdMode" @update:mode="wdMode = $event" />
      </div>
      <table v-if="wdMode === 'table' && weekdayRows?.length" class="min-w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-gray-500">
            <th>Datum</th>
            <th class="text-right">Omzet</th>
            <th class="text-right">Vgl.</th>
            <th class="text-right">%</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in weekdayRows" :key="r.date" class="border-t">
            <td class="py-1">{{ r.date }}</td>
            <td class="py-1 text-right">{{ formatEur(r.revenue) }}</td>
            <td class="py-1 text-right">{{ r.compareRevenue != null ? formatEur(r.compareRevenue) : '—' }}</td>
            <td class="py-1 text-right">{{ r.comparePct != null ? `${r.comparePct}%` : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <ChartsD3LineChart
        v-else-if="weekdayRows?.length"
        :series="wdSeries"
        :width="640"
        :height="240"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { D3LineSeries } from '~/components/charts/D3LineChart.vue'
import type {
  DailyOpsRevenueRollingMediansDto,
  DailyOpsRevenueTimeseriesDto,
} from '~/types/daily-ops-revenue'

const props = defineProps<{
  timeseries: DailyOpsRevenueTimeseriesDto | null
  rollingMedians: DailyOpsRevenueRollingMediansDto | null
}>()

const { formatEur } = useDashboardEurFormat()
const { weekdayPattern } = useDailyOpsRevenueMetrics()
const { mode: tsMode } = useDailyOpsRevenueViewMode('rev-ts-view', 'chart')
const { mode: wdMode } = useDailyOpsRevenueViewMode('rev-wd-view', 'table')
const weekdayPick = ref('monday')
const { data: weekdayRows } = weekdayPattern(weekdayPick)

const tsSeries = computed((): D3LineSeries[] => {
  if (!props.timeseries) return []
  const s: D3LineSeries[] = [
    {
      id: 'current',
      label: 'Huidig',
      color: '#111827',
      points: props.timeseries.current.map((p) => ({ date: p.date, value: p.revenue })),
    },
  ]
  if (props.timeseries.compare?.length) {
    s.push({
      id: 'compare',
      label: props.timeseries.compareLabel ?? 'Vergelijking',
      color: '#9ca3af',
      dashed: true,
      points: props.timeseries.compare.map((p) => ({ date: p.date, value: p.revenue })),
    })
  }
  return s
})

const wdSeries = computed((): D3LineSeries[] => {
  const rows = weekdayRows.value ?? []
  return [
    {
      id: 'wd',
      label: weekdayPick.value,
      color: '#059669',
      points: rows.map((r) => ({ date: r.date, value: r.revenue })),
    },
  ]
})
</script>
