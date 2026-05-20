<template>
  <section class="space-y-6">
    <DailyOpsRevenueKpiStrip :summary="summary" />
    <DailyOpsRevenuePnLCard :pnl="pnl" />
    <div v-if="locations?.length" class="grid gap-6 lg:grid-cols-2">
      <ChartsD3PieChartV2 :data="pieData" :width="360" :height="280" />
      <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th class="px-3 py-2">Zaak</th>
              <th class="px-3 py-2 text-right">Omzet</th>
              <th class="px-3 py-2 text-right">%</th>
              <th v-if="hasLocCompare" class="px-3 py-2 text-right">VJ / vgl.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="loc in locations" :key="loc.locationId" class="border-t">
              <td class="px-3 py-2">{{ loc.locationName }}</td>
              <td class="px-3 py-2 text-right">{{ formatEur(loc.revenue) }}</td>
              <td class="px-3 py-2 text-right">{{ loc.pctOfTotal }}%</td>
              <td v-if="hasLocCompare" class="px-3 py-2 text-right text-xs text-gray-600">
                {{ loc.compareRevenue != null ? formatEur(loc.compareRevenue) : '—' }}
                <span v-if="loc.comparePct != null"> ({{ loc.comparePct }}%)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DailyOpsRevenueKpiDto, DailyOpsRevenueLocationDto, DailyOpsSimplePnLDto } from '~/types/daily-ops-revenue'

const props = defineProps<{
  summary: DailyOpsRevenueKpiDto | null
  pnl: DailyOpsSimplePnLDto | null
  locations: DailyOpsRevenueLocationDto[] | null
}>()

const { formatEur } = useDashboardEurFormat()
const hasLocCompare = computed(() => props.locations?.some((l) => l.compareRevenue != null) ?? false)
const pieData = computed(() =>
  (props.locations ?? []).map((l) => ({ label: l.locationName, value: l.revenue })),
)
</script>
