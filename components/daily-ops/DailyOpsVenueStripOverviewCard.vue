<template>
  <div class="grid min-w-0 grid-cols-2 gap-2">
    <component
      :is="tile.drawerKind ? 'button' : 'div'"
      v-for="tile in tiles"
      :key="tile.id"
      :type="tile.drawerKind ? 'button' : undefined"
      class="rounded-lg border-[1.5px] border-gray-900 bg-white p-3 text-left shadow-none"
      :class="tile.drawerKind ? 'transition-colors hover:bg-gray-50 active:scale-[0.98]' : ''"
      @click="tile.drawerKind ? openDrawer = tile.drawerKind : undefined"
    >
      <p class="text-xs font-medium text-gray-500">{{ tile.label }}</p>
      <p class="mt-1 text-xl font-semibold tabular-nums text-gray-900">{{ tile.primary }}</p>
      <p
        v-for="(line, index) in tile.details"
        :key="`${tile.id}-detail-${index}`"
        class="mt-0.5 font-medium tabular-nums text-gray-600"
        :class="tile.detailClass ?? 'text-xs'"
      >
        {{ line }}
      </p>
      <p
        v-if="tile.secondary"
        class="mt-0.5 text-xs font-medium tabular-nums text-gray-600"
      >
        {{ tile.secondary }}
      </p>
    </component>

    <DailyOpsKpiDrawer
      :is-open="openDrawer != null"
      :title="drawerContent.title"
      :intro="drawerContent.intro"
      :summary-rows="drawerContent.summaryRows"
      :venue-sections="drawerContent.venueSections"
      @close="openDrawer = null"
    />
  </div>
</template>

<script setup lang="ts">
import DailyOpsKpiDrawer from '~/components/daily-ops/DailyOpsKpiDrawer.vue'
import type { KpiDrawerSummaryRow, KpiDrawerVenueSection } from '~/components/daily-ops/DailyOpsKpiDrawer.vue'
import type { DailyOpsAttendanceStaffRowDto, DailyOpsAttendanceVenueDto, VenueStripCardDto } from '~/types/daily-ops-dashboard'

type VenueOverviewDrawerKind =
  | 'active'
  | 'verlof'
  | 'labor-all'
  | 'labor-keuken'
  | 'labor-bediening'

type LaborStaffFilter = 'all' | 'keuken' | 'bediening'

type OverviewTile = {
  id: string
  label: string
  primary: string
  details?: string[]
  detailClass?: string
  secondary?: string
  drawerKind?: VenueOverviewDrawerKind
}

const props = defineProps<{
  venue: VenueStripCardDto
  showActive: boolean
  leaveVenue?: DailyOpsAttendanceVenueDto | null
  sickVenue?: DailyOpsAttendanceVenueDto | null
}>()

const { formatEurWhole, formatEurPerHourWhole, formatPctWhole, formatHoursWhole } = useDashboardKpiFormat()

const openDrawer = ref<VenueOverviewDrawerKind | null>(null)

function laborPctDisplay (
  bucket: 'all' | 'keuken' | 'bediening',
  loaded: number,
  fallback: number | null,
  revenue: VenueStripCardDto['revenue'],
): number | null {
  const rev =
    bucket === 'keuken' ? revenue.food
      : bucket === 'bediening' ? revenue.beverage
        : revenue.total
  if (rev > 0 && loaded > 0) return Math.round((loaded / rev) * 10000) / 100
  return fallback
}

function laborTile (
  id: 'labor-all' | 'labor-keuken' | 'labor-bediening',
  label: string,
  bucket: 'all' | 'keuken' | 'bediening',
  loaded: number,
  laborPctOfRevenue: number | null,
  productivity: number | null,
  revenue: VenueStripCardDto['revenue'],
): OverviewTile {
  const pct = formatPctWhole(laborPctDisplay(bucket, loaded, laborPctOfRevenue, revenue))
  const perHour = formatEurPerHourWhole(productivity)
  return {
    id,
    label,
    primary: formatEurWhole(loaded),
    detailClass: 'text-sm',
    details: [
      `Labor % of rev ${pct}`,
      `Productivity ${perHour}`,
    ],
    drawerKind: id,
  }
}

function staffForLaborFilter(filter: LaborStaffFilter) {
  let workers = props.venue.workers ?? []
  if (filter === 'all') {
    workers = collapseAfwasSplitLinesForDisplay(workers)
  }
  return workers
    .filter((w) => filter === 'all' || w.bucket === filter)
    .map((w) => ({
      name: w.userName,
      team: formatVenueStripWorkerTeamLabel(w.teamName),
      startLabel: w.startLabel,
      endLabel: w.endLabel,
      hours: formatHoursWhole(w.hours),
      wages: formatEurWhole(w.wages),
    }))
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

function isVakantieRow(row: DailyOpsAttendanceStaffRowDto): boolean {
  const hay = `${row.reason ?? ''} ${row.teamName ?? ''} ${row.status ?? ''}`.toLowerCase()
  return hay.includes('vakantie') || hay.includes('vacation')
}

function uniqueWorkerCount(rows: DailyOpsAttendanceStaffRowDto[]): number {
  return new Set(rows.map((r) => r.userId || r.userName).filter(Boolean)).size
}

const leaveRowsSplit = computed(() => {
  const leaveRows = props.leaveVenue?.rows ?? []
  return {
    verlof: leaveRows.filter((r) => !isVakantieRow(r)),
    vakantie: leaveRows.filter(isVakantieRow),
  }
})

const verlofDisplay = computed(() => {
  const { verlof: verlofRows, vakantie: vakantieRows } = leaveRowsSplit.value
  const verlof = uniqueWorkerCount(verlofRows)
  const vakantie = uniqueWorkerCount(vakantieRows)
  const ziek = props.sickVenue?.workers ?? uniqueWorkerCount(props.sickVenue?.rows ?? [])
  return { verlof, vakantie, ziek, verlofRows, vakantieRows }
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
      'all',
      props.venue.labor.all.loaded,
      props.venue.labor.all.laborPctOfRevenue,
      props.venue.productivity.totalPerHour,
      props.venue.revenue,
    ),
    laborTile(
      'labor-keuken',
      'Labor Keuken',
      'keuken',
      props.venue.labor.keuken.loaded,
      props.venue.labor.keuken.laborPctOfRevenue,
      props.venue.productivity.keukenPerHour,
      props.venue.revenue,
    ),
    laborTile(
      'labor-bediening',
      'Labor Bediening',
      'bediening',
      props.venue.labor.bediening.loaded,
      props.venue.labor.bediening.laborPctOfRevenue,
      props.venue.productivity.bedieningPerHour,
      props.venue.revenue,
    ),
  ]

  if (props.showActive) {
    base.push({
      id: 'active',
      label: 'Active',
      primary: activeDisplay.value,
      secondary: 'Total · Keuken · Bediening',
      drawerKind: 'active',
    })
  }

  base.push({
    id: 'verlof',
    label: 'Verlof',
    primary: `${verlofDisplay.value.verlof} · ${verlofDisplay.value.vakantie} · ${verlofDisplay.value.ziek}`,
    secondary: 'Verlof · Vakantie · Ziek',
    drawerKind: 'verlof',
  })

  return base
})

const drawerContent = computed((): {
  title: string
  intro: string
  summaryRows: KpiDrawerSummaryRow[]
  venueSections: KpiDrawerVenueSection[]
} => {
  const empty = {
    title: '',
    intro: '',
    summaryRows: [] as KpiDrawerSummaryRow[],
    venueSections: [] as KpiDrawerVenueSection[],
  }
  if (!openDrawer.value) return empty

  const locationName = props.venue.locationName

  if (openDrawer.value === 'active') {
    const rows = props.venue.active?.rows ?? []
    const hours = rows.reduce((sum, row) => sum + row.hoursWorked, 0)
    const wages = rows.reduce((sum, row) => sum + row.wages, 0)
    return {
      title: `Active · ${locationName}`,
      intro:
        'Staff currently on the floor: Eitje check_ins with clock-in and no clock-out yet. Excludes Ziek, Verlof, and Vakantie.',
      summaryRows: [
        { label: 'Active workers', value: String(props.venue.active?.workers ?? rows.length) },
        { label: 'Hours worked (so far)', value: formatHoursWhole(hours) },
        { label: 'Loaded cost (so far)', value: formatEurWhole(wages) },
      ],
      venueSections: [
        {
          locationName,
          cells: [
            String(props.venue.active?.workers ?? rows.length),
            formatHoursWhole(hours),
            formatEurWhole(wages),
          ],
          staff: rows.map((row) => ({
            name: row.userName,
            team: row.teamName,
            startLabel: row.startLabel,
            endLabel: 'Active',
            hours: formatHoursWhole(row.hoursWorked),
            wages: row.wages > 0 ? formatEurWhole(row.wages) : '—',
          })),
          staffColumns: {
            hours: 'Hours worked',
            end: 'Status',
            wages: 'Cost',
          },
        },
      ],
    }
  }

  if (
    openDrawer.value === 'labor-all'
    || openDrawer.value === 'labor-keuken'
    || openDrawer.value === 'labor-bediening'
  ) {
    const kind = openDrawer.value
    const laborBlock =
      kind === 'labor-keuken'
        ? props.venue.labor.keuken
        : kind === 'labor-bediening'
          ? props.venue.labor.bediening
          : props.venue.labor.all
    const bucket: 'all' | 'keuken' | 'bediening' =
      kind === 'labor-keuken' ? 'keuken' : kind === 'labor-bediening' ? 'bediening' : 'all'
    const staffFilter: LaborStaffFilter = bucket
    const productivity =
      kind === 'labor-keuken'
        ? props.venue.productivity.keukenPerHour
        : kind === 'labor-bediening'
          ? props.venue.productivity.bedieningPerHour
          : props.venue.productivity.totalPerHour
    const pct = formatPctWhole(
      laborPctDisplay(bucket, laborBlock.loaded, laborBlock.laborPctOfRevenue, props.venue.revenue),
    )
    const title =
      kind === 'labor-keuken'
        ? `Labor Keuken · ${locationName}`
        : kind === 'labor-bediening'
          ? `Labor Bediening · ${locationName}`
          : `Labor All · ${locationName}`
    const intro =
      kind === 'labor-all'
        ? 'All Eitje hours and loaded cost for this venue. Staff list shows gewerkte uren lines from the snapshot.'
        : kind === 'labor-keuken'
          ? 'Keuken team gewerkte hours and loaded cost (includes half of Afwas per person). Productivity = food revenue ÷ keuken hours.'
          : 'Bediening team gewerkte hours and loaded cost (includes half of Afwas per person). Productivity = beverage revenue ÷ bediening hours.'

    return {
      title,
      intro,
      summaryRows: [
        { label: 'Loaded cost', value: formatEurWhole(laborBlock.loaded) },
        { label: 'Labor % of rev', value: pct },
        { label: 'Productivity', value: formatEurPerHourWhole(productivity) },
        { label: 'Hours', value: formatHoursWhole(laborBlock.hours) },
        { label: 'Workers', value: String(laborBlock.workers) },
      ],
      venueSections: [
        {
          locationName,
          cells: [
            formatHoursWhole(laborBlock.hours),
            formatEurWhole(laborBlock.loaded),
            pct,
          ],
          staff: staffForLaborFilter(staffFilter),
        },
      ],
    }
  }

  const { verlof, vakantie, ziek, verlofRows, vakantieRows } = verlofDisplay.value
  const sickRows = props.sickVenue?.rows ?? []
  const leaveHours = [...verlofRows, ...vakantieRows].reduce((sum, row) => sum + row.hours, 0)
  const sickHours = sickRows.reduce((sum, row) => sum + row.hours, 0)
  const sickLoaded = props.sickVenue?.loaded ?? sickRows.reduce((sum, row) => sum + row.loaded, 0)

  const staff = [
    ...verlofRows.map((row) => ({
      name: row.userName,
      team: row.reason?.trim() || 'Verlof',
      hours: formatHoursWhole(row.hours),
      wages: `${row.fromLabel ?? '—'} - ${row.toLabel ?? '—'}`,
    })),
    ...vakantieRows.map((row) => ({
      name: row.userName,
      team: 'Vakantie',
      hours: formatHoursWhole(row.hours),
      wages: `${row.fromLabel ?? '—'} - ${row.toLabel ?? '—'}`,
    })),
    ...sickRows.map((row) => ({
      name: row.userName,
      team: 'Ziek',
      hours: formatHoursWhole(row.hours),
      wages: formatEurWhole(row.loaded),
    })),
  ]

  return {
    title: `Verlof · ${locationName}`,
    intro: 'Leave and sick for this venue on the selected date(s): verlof requests, vakantie, and Ziek hours from Eitje.',
    summaryRows: [
      { label: 'Verlof', value: String(verlof) },
      { label: 'Vakantie', value: String(vakantie) },
      { label: 'Ziek', value: String(ziek) },
      { label: 'Leave hours', value: formatHoursWhole(leaveHours) },
      { label: 'Sick hours', value: formatHoursWhole(sickHours) },
      { label: 'Sick cost', value: formatEurWhole(sickLoaded) },
    ],
    venueSections: [
      {
        locationName,
        cells: [
          `${verlof + vakantie + ziek} staff`,
          formatHoursWhole(leaveHours + sickHours),
          formatEurWhole(sickLoaded),
        ],
        staff,
        staffColumns: {
          hours: 'Hours',
          wages: 'From - to / cost',
        },
        showShiftTimeColumns: false,
      },
    ],
  }
})
</script>
