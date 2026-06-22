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

const { formatEurWhole, formatEurPerHourWhole, formatPctWhole } = useDashboardKpiFormat()

function laborTile (
  id: string,
  label: string,
  loaded: number,
  laborPctOfRevenue: number | null,
  productivity: number | null,
): OverviewTile {
  const pct = formatPctWhole(laborPctOfRevenue)
  const perHour = formatEurPerHourWhole(productivity)
  return {
    id,
    label,
    primary: formatEurWhole(loaded),
    secondary: pct !== '—' ? `${pct} rev · ${perHour}` : perHour,
  }
}

const activeDisplay = computed(() => {
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

const tiles = computed((): OverviewTile[] => {
  const base: OverviewTile[] = [
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
      props.venue.labor.all.laborPctOfRevenue,
      props.venue.productivity.totalPerHour,
    ),
    laborTile(
      'labor-keuken',
      'Labor Keuken',
      props.venue.labor.keuken.loaded,
      props.venue.labor.keuken.laborPctOfRevenue,
      props.venue.productivity.keukenPerHour,
    ),
    laborTile(
      'labor-bediening',
      'Labor Bediening',
      props.venue.labor.bediening.loaded,
      props.venue.labor.bediening.laborPctOfRevenue,
      props.venue.productivity.bedieningPerHour,
    ),
  ]

  if (props.showActive) {
    base.push({
      id: 'active',
      label: 'Active',
      primary: activeDisplay.value,
      secondary: 'Total · Keuken · Bediening',
    })
  }

  return base
})
</script>
