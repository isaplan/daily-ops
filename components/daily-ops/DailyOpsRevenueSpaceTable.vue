<template>
  <UCard class="border-2 border-gray-900 bg-white! ring-0 shadow-none">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Revenue Per Space</h3>
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-info"
          aria-label="Configure revenue spaces"
          class="text-gray-500"
          @click="configOpen = true"
        />
      </div>
    </template>

    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-3 py-2 text-left font-semibold">Space</th>
            <th class="px-3 py-2 text-left font-semibold">Venue</th>
            <th class="px-3 py-2 text-right font-semibold">Revenue</th>
            <th class="px-3 py-2 text-right font-semibold">Qty</th>
            <th class="px-3 py-2 text-right font-semibold">% venue</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="row in rows"
            :key="`${row.locationId}-${row.spaceName}`"
          >
            <td class="px-3 py-2 font-medium text-gray-900">{{ row.spaceName }}</td>
            <td class="px-3 py-2 text-gray-600">{{ row.locationName }}</td>
            <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ formatEur(row.revenue) }}</td>
            <td class="px-3 py-2 text-right text-gray-600">{{ formatNumber(row.quantity) }}</td>
            <td class="px-3 py-2 text-right text-gray-600">{{ row.pctOfVenueRevenue == null ? '—' : `${row.pctOfVenueRevenue}%` }}</td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="5" class="px-3 py-8 text-center text-sm text-gray-500">
              No per-space snapshot rows available yet.
              <button
                type="button"
                class="mt-1 block w-full text-xs font-medium text-gray-700 underline"
                @click="configOpen = true"
              >
                Configure table → space mapping
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <DailyOpsRevenueSpaceConfigModal
      v-model:open="configOpen"
      :initial-location-id="initialLocationId"
      @saved="$emit('configSaved')"
    />
  </UCard>
</template>

<script setup lang="ts">
import type { DailyOpsRevenueDrilldownSpaceRowDto } from '~/types/daily-ops-dashboard'

defineProps<{
  rows: DailyOpsRevenueDrilldownSpaceRowDto[]
  initialLocationId?: string | null
}>()

defineEmits<{
  configSaved: []
}>()

const configOpen = ref(false)
const { formatEur } = useDashboardEurFormat()

function formatNumber(value: number): string {
  return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(value)
}
</script>
