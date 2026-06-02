<template>
  <UCard class="border-2 border-gray-900 bg-white! ring-0 shadow-none">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600">Revenue Per Space</h3>
        <button
          type="button"
          class="inline-flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          aria-label="Configure revenue spaces"
          @click.stop="configOpen = true"
        >
          <UIcon name="i-lucide-info" class="size-4" />
        </button>
      </div>
    </template>

    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-3 py-2 text-left font-semibold">Venue</th>
            <th class="px-3 py-2 text-left font-semibold">Space</th>
            <th class="px-3 py-2 text-right font-semibold">Revenue</th>
            <th class="px-3 py-2 text-right font-semibold">Qty</th>
            <th class="px-3 py-2 text-right font-semibold">% venue</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="(row, index) in sortedRows"
            :key="`${row.locationId}-${row.spaceName}`"
            :class="index > 0 && row.isFirstInVenue ? 'border-t-2 border-gray-200' : ''"
          >
            <td class="px-3 py-2 text-gray-900">{{ row.locationName }}</td>
            <td class="px-3 py-2 font-medium text-gray-900">{{ row.spaceName }}</td>
            <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ formatEur(row.revenue) }}</td>
            <td class="px-3 py-2 text-right text-gray-600">{{ formatNumber(row.quantity) }}</td>
            <td class="px-3 py-2 text-right text-gray-600">{{ row.pctOfVenueRevenue == null ? '—' : `${Math.round(row.pctOfVenueRevenue)}%` }}</td>
          </tr>
          <tr v-if="sortedRows.length === 0">
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

  </UCard>

  <DailyOpsRevenueSpaceConfigModal
    :open="configOpen"
    :initial-location-id="initialLocationId"
    @update:open="configOpen = $event"
    @saved="$emit('configSaved')"
  />
</template>

<script setup lang="ts">
import type { DailyOpsRevenueDrilldownSpaceRowDto } from '~/types/daily-ops-dashboard'
import { sortRevenueDrilldownSpaceRows } from '~/utils/dailyOpsVenueOrder'

const props = defineProps<{
  rows: DailyOpsRevenueDrilldownSpaceRowDto[]
  initialLocationId?: string | null
}>()

defineEmits<{
  configSaved: []
}>()

const configOpen = ref(false)
const { formatEur } = useDashboardEurFormat()

type SpaceTableRow = DailyOpsRevenueDrilldownSpaceRowDto & { isFirstInVenue: boolean }

const sortedRows = computed((): SpaceTableRow[] => {
  const ordered = sortRevenueDrilldownSpaceRows(props.rows)
  return ordered.map((row, index) => ({
    ...row,
    isFirstInVenue: index === 0 || ordered[index - 1]?.locationId !== row.locationId,
  }))
})

function formatNumber(value: number): string {
  return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(Math.round(value))
}
</script>
