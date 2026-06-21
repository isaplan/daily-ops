<template>
  <div class="grid min-w-0 grid-cols-2 gap-2">
    <div
      v-for="tile in tiles"
      :key="tile.id"
      class="rounded-lg border-[1.5px] border-gray-900 bg-white p-3 text-left shadow-none"
    >
      <p class="text-xs font-medium text-gray-500">{{ tile.label }}</p>
      <p class="mt-1 text-xl font-semibold tabular-nums text-gray-900">{{ tile.primary }}</p>
      <p
        v-for="(line, index) in tile.details"
        :key="`${tile.id}-detail-${index}`"
        class="mt-0.5 text-xs font-medium tabular-nums text-gray-600"
      >
        {{ line }}
      </p>
      <p
        v-if="tile.secondary"
        class="mt-0.5 text-xs font-medium tabular-nums text-gray-600"
      >
        {{ tile.secondary }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VenueStripCardDto } from '~/types/daily-ops-dashboard'

type OverviewTile = {
  id: string
  label: string
  primary: string
  details?: string[]
  secondary?: string
}

const props = defineProps<{
  venue: VenueStripCardDto
  showActive: boolean
}>()

const { formatEurWhole, formatEurPerHourWhole } = useDashboardKpiFormat()

function laborTile (
  id: string,
  label: string,
  loaded: number,
  productivity: number | null,
): OverviewTile {
  return {
    id,
    label,
    primary: formatEurWhole(loaded),
    secondary: formatEurPerHourWhole(productivity),
  }
}

const activeDisplay = computed(() => {
  if (!props.showActive) return '—'
  const rows = props.venue.active?.rows ?? []
  let keuken = 0
  let bediening = 0
  for (const row of rows) {
    const team = (row.teamName ?? '').trim().toLowerCase()
    if (team === 'keuken') keuken++
    else if (team === 'bediening') bediening++
  }
  const total = props.venue.active?.workers ?? rows.length
  return `${total} · ${keuken} · ${bediening}`
})

const tiles = computed((): OverviewTile[] => [
  {
    id: 'revenue',
    label: 'Revenue',
    primary: formatEurWhole(props.venue.revenue.total),
    details: [
      `Keuken ${formatEurWhole(props.venue.revenue.food)}`,
      `Bediening ${formatEurWhole(props.venue.revenue.beverage)}`,
    ],
  },
  laborTile(
    'labor-all',
    'Labor All',
    props.venue.labor.all.loaded,
    props.venue.productivity.totalPerHour,
  ),
  laborTile(
    'labor-keuken',
    'Labor Keuken',
    props.venue.labor.keuken.loaded,
    props.venue.productivity.keukenPerHour,
  ),
  laborTile(
    'labor-bediening',
    'Labor Bediening',
    props.venue.labor.bediening.loaded,
    props.venue.productivity.bedieningPerHour,
  ),
  {
    id: 'active',
    label: 'Active',
    primary: activeDisplay.value,
    secondary: props.showActive ? 'Total · Keuken · Bediening' : undefined,
  },
])
</script>
