<template>
  <section class="min-w-0">
    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <USkeleton v-for="i in 8" :key="i" class="h-24 w-full rounded-lg" />
    </div>

    <div
      v-else-if="totals"
      class="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8"
    >
      <template v-for="tile in tiles">
        <button
          v-if="tile.opensDrawer"
          :key="tile.id"
          type="button"
          class="rounded-lg border-2 border-gray-900 bg-white p-4 text-left shadow-none transition-all hover:bg-gray-50 hover:shadow-md active:scale-[0.98]"
          @click="openTile(tile.id)"
        >
          <p class="text-sm font-medium text-gray-500">{{ tile.label }}</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{{ tile.display }}</p>
        </button>
        <div
          v-else
          :key="`${tile.id}-summary`"
          class="rounded-lg border-2 border-gray-900 bg-white p-4 text-left shadow-none"
        >
          <p class="text-sm font-medium text-gray-500">{{ tile.label }}</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{{ tile.display }}</p>
        </div>
      </template>
    </div>

    <DailyOpsKpiDrawer
      :is-open="activeDrawer != null"
      :title="drawerContent.title"
      :intro="drawerContent.intro"
      :summary-rows="drawerContent.summaryRows"
      :venue-columns="drawerContent.venueColumns"
      :venue-rows="drawerContent.venueRows"
      :venue-sections="drawerContent.venueSections"
      @close="activeDrawer = null"
    />
  </section>
</template>

<script setup lang="ts">
import type { DailyOpsSummaryDto, VenueStripCardDto, VenueStripResponseDto } from '~/types/daily-ops-dashboard'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import type { KpiDrawerVenueSection } from '~/components/daily-ops/DailyOpsKpiDrawer.vue'

type KpiDrawerSummaryRow = { label: string; value: string }
type KpiDrawerVenueRow = { locationName: string; cells: string[] }

type GewerktStaffFilter = 'gewerkt' | 'keuken' | 'bediening' | 'overig'

type KpiTileId =
  | 'revenue'
  | 'labor'
  | 'laborPct'
  | 'productivity'
  | 'gewerkt'
  | 'gewerktKeuken'
  | 'gewerktBediening'
  | 'gewerktOverig'

const props = defineProps<{
  period: string
  anchor?: string | null
  summary?: DailyOpsSummaryDto | null
}>()

const { formatEurWhole, formatHoursWhole, formatPctWhole, formatEurPerHourWhole } = useDashboardKpiFormat()

const isSingleDayPeriod = computed(() => {
  const { startDate, endDate } = resolveDailyOpsPeriod(
    typeof props.period === 'string' ? props.period : 'today',
    props.anchor ?? undefined
  )
  return startDate === endDate
})

const stripQuery = computed(() => {
  const q: Record<string, string> = { period: props.period }
  if (props.anchor) q.anchor = props.anchor
  return q
})

const cacheKey = computed(() => `daily-ops-venue-strip-${props.period}-${props.anchor ?? ''}`)

const { data: stripData, pending } = await useAsyncData(
  cacheKey,
  async (): Promise<VenueStripResponseDto | null> => {
    if (!isSingleDayPeriod.value) return null
    return await $fetch<VenueStripResponseDto>('/api/daily-ops/metrics/venue-strip', {
      query: stripQuery.value,
    })
  },
  { watch: [cacheKey, isSingleDayPeriod] }
)

const venues = computed(() => stripData.value?.venues ?? [])

const totals = computed(() => {
  const list = venues.value
  if (!list.length) return null
  let revenue = 0
  let laborAllLoaded = 0
  let laborGewerktLoaded = 0
  let allHours = 0
  let gewerktHours = 0
  let keukenHours = 0
  let bedieningHours = 0
  let otherHours = 0
  for (const v of list) {
    revenue += v.revenue.total
    laborAllLoaded += v.labor.all.loaded
    laborGewerktLoaded += v.labor.gewerkt.loaded
    allHours += v.labor.all.hours
    gewerktHours += v.labor.gewerkt.hours
    keukenHours += v.labor.keuken.hours
    bedieningHours += v.labor.bediening.hours
    otherHours += v.labor.other?.hours ?? 0
  }
  const laborGewerktPct = revenue > 0 ? (laborGewerktLoaded / revenue) * 100 : null
  const laborAllPct = revenue > 0 ? (laborAllLoaded / revenue) * 100 : null
  const productivity = gewerktHours > 0 && revenue > 0 ? revenue / gewerktHours : null
  return {
    revenue,
    laborAllLoaded,
    laborGewerktLoaded,
    laborGewerktPct,
    laborAllPct,
    laborPct: laborGewerktPct,
    productivity,
    allHours,
    gewerktHours,
    keukenHours,
    bedieningHours,
    otherHours,
  }
})

const tiles = computed(() => {
  const t = totals.value
  if (!t) return []
  return [
    { id: 'revenue' as const, label: 'Total Revenue', display: formatEurWhole(t.revenue), opensDrawer: true },
    { id: 'labor' as const, label: 'Total Labor Cost', display: formatEurWhole(t.laborGewerktLoaded), opensDrawer: true },
    { id: 'laborPct' as const, label: 'Labor Percentage', display: formatPctWhole(t.laborPct), opensDrawer: true },
    { id: 'productivity' as const, label: 'Labor Productivity', display: formatEurPerHourWhole(t.productivity), opensDrawer: true },
    {
      id: 'gewerkt' as const,
      label: 'All uren',
      display: formatHoursWhole(t.allHours),
      opensDrawer: false,
    },
    { id: 'gewerktKeuken' as const, label: 'Gewerkte uren · Keuken', display: formatHoursWhole(t.keukenHours), opensDrawer: true },
    { id: 'gewerktBediening' as const, label: 'Gewerkte uren · Bediening', display: formatHoursWhole(t.bedieningHours), opensDrawer: true },
    { id: 'gewerktOverig' as const, label: 'Gewerkte uren · Overig', display: formatHoursWhole(t.otherHours), opensDrawer: true },
  ]
})

const activeDrawer = ref<KpiTileId | null>(null)

function openTile (id: KpiTileId): void {
  activeDrawer.value = id
}

function venueRevenueRows (): KpiDrawerVenueRow[] {
  return venues.value.map((v) => ({
    locationName: v.locationName,
    cells: [
      formatEurWhole(v.revenue.total),
      formatEurWhole(v.revenue.food),
      formatEurWhole(v.revenue.beverage),
    ],
  }))
}

function venueLaborRows (): KpiDrawerVenueRow[] {
  return venues.value.map((v) => ({
    locationName: v.locationName,
    cells: [
      formatEurWhole(v.labor.gewerkt.loaded),
      formatPctWhole(v.labor.gewerkt.laborPctOfRevenue),
      formatEurWhole(v.labor.all.loaded),
      formatPctWhole(v.labor.all.laborPctOfRevenue),
    ],
  }))
}

function venueGewerktRows (): KpiDrawerVenueRow[] {
  return venues.value.map((v) => ({
    locationName: v.locationName,
    cells: [
      formatHoursWhole(v.labor.gewerkt.hours),
      formatEurWhole(v.labor.gewerkt.loaded),
      formatPctWhole(v.labor.gewerkt.laborPctOfRevenue),
    ],
  }))
}

function venueKeukenRows (): KpiDrawerVenueRow[] {
  return venues.value.map((v) => ({
    locationName: v.locationName,
    cells: [
      formatHoursWhole(v.labor.keuken.hours),
      formatEurWhole(v.labor.keuken.loaded),
      formatEurPerHourWhole(v.productivity.keukenPerHour),
    ],
  }))
}

function venueBedieningRows (): KpiDrawerVenueRow[] {
  return venues.value.map((v) => ({
    locationName: v.locationName,
    cells: [
      formatHoursWhole(v.labor.bediening.hours),
      formatEurWhole(v.labor.bediening.loaded),
      formatEurPerHourWhole(v.productivity.bedieningPerHour),
    ],
  }))
}

function staffForVenue (venue: VenueStripCardDto, filter: GewerktStaffFilter) {
  const workers = venue.workers ?? []
  return workers
    .filter((w) => {
      if (filter === 'gewerkt') return w.bucket === 'keuken' || w.bucket === 'bediening'
      return w.bucket === filter
    })
    .map((w) => ({
      name: w.userName,
      team: w.teamName,
      hours: formatHoursWhole(w.hours),
      wages: formatEurWhole(w.wages),
    }))
}

function venueSectionsForGewerkt (
  filter: GewerktStaffFilter,
  cellsForVenue: (v: VenueStripCardDto) => string[],
): KpiDrawerVenueSection[] {
  return venues.value.map((v) => ({
    locationName: v.locationName,
    cells: cellsForVenue(v),
    staff: staffForVenue(v, filter),
  }))
}

const drawerContent = computed(() => {
  const t = totals.value
  const empty = {
    title: '',
    intro: '',
    summaryRows: [] as KpiDrawerSummaryRow[],
    venueColumns: [] as string[],
    venueRows: [] as KpiDrawerVenueRow[],
    venueSections: [] as KpiDrawerVenueSection[],
  }
  if (!t || !activeDrawer.value) return empty

  const s = props.summary?.summary
  const rs = s?.revenueSources

  switch (activeDrawer.value) {
    case 'revenue':
      return {
        title: 'Total Revenue',
        intro: s?.revenueLeadSource === 'inbox_basis_ex_vat'
          ? 'Headline uses Inbox Basis Report (full business day, ex VAT) per venue when available.'
          : 'Headline uses Bork API business-day aggregates (ex VAT).',
        summaryRows: [
          { label: 'Combined (3 venues)', value: formatEurWhole(t.revenue) },
          {
            label: 'Inbox Basis · ex VAT (bundle)',
            value: rs?.inboxBasisExVat != null ? formatEurWhole(rs.inboxBasisExVat) : '—',
          },
          {
            label: 'Bork API · ex VAT (bundle)',
            value: rs != null ? formatEurWhole(rs.apiBusinessDaysTotal) : '—',
          },
        ],
        venueColumns: ['Total', 'Food', 'Beverage'],
        venueRows: venueRevenueRows(),
      }
    case 'labor':
      return {
        title: 'Total Labor Cost',
        intro: 'Leading figure is gewerkte uren wages (operational). All-hours wages include Ziek, Management, etc.',
        summaryRows: [
          {
            label: 'Gewerkte (combined)',
            value: `${formatEurWhole(t.laborGewerktWages)} · ${formatPctWhole(t.laborGewerktPct)} rev`,
          },
          {
            label: 'All hours (combined)',
            value: `${formatEurWhole(t.laborAllWages)} · ${formatPctWhole(t.laborAllPct)} rev`,
          },
        ],
        venueColumns: ['Gewerkte €', 'Gewerkte % rev', 'All hours €', 'All hours % rev'],
        venueRows: venueLaborRows(),
      }
    case 'laborPct':
      return {
        title: 'Labor Percentage',
        intro: 'Gewerkte wage cost ÷ total revenue × 100 (combined across Van Kinsbergen, Bar Bea, L\'amour).',
        summaryRows: [
          { label: 'Combined', value: formatPctWhole(t.laborPct) },
          { label: 'Gewerkte wages', value: formatEurWhole(t.laborGewerktWages) },
          { label: 'Revenue', value: formatEurWhole(t.revenue) },
        ],
        venueColumns: ['Gewerkte h', 'Gewerkte €', '% rev'],
        venueRows: venueGewerktRows(),
      }
    case 'productivity':
      return {
        title: 'Labor Productivity',
        intro: 'Revenue ÷ gewerkte uren (€/h). Keuken uses food revenue; Bediening uses beverage revenue per venue strip.',
        summaryRows: [
          { label: 'Combined €/h', value: formatEurPerHourWhole(t.productivity) },
          { label: 'Revenue', value: formatEurWhole(t.revenue) },
          { label: 'Gewerkte hours', value: formatHoursWhole(t.gewerktHours) },
        ],
        venueColumns: ['Hours', 'Wages', '€/h (team)'],
        venueRows: venues.value.map((v) => ({
          locationName: v.locationName,
          cells: [
            formatHoursWhole(v.labor.gewerkt.hours),
            formatEurWhole(v.labor.gewerkt.loaded),
            formatEurPerHourWhole(v.productivity.totalPerHour),
          ],
        })),
      }
    case 'gewerktKeuken':
      return {
        title: 'Gewerkte uren · Keuken',
        intro: 'Keuken team gewerkte hours (plus half of Afwas per person).',
        summaryRows: [
          { label: 'Combined Keuken hours', value: formatHoursWhole(t.keukenHours) },
        ],
        venueColumns: ['Hours', 'Wages', 'Food €/h'],
        venueRows: [],
        venueSections: venueSectionsForGewerkt('keuken', (v) => [
          formatHoursWhole(v.labor.keuken.hours),
          formatEurWhole(v.labor.keuken.loaded),
          formatEurPerHourWhole(v.productivity.keukenPerHour),
        ]),
      }
    case 'gewerktBediening':
      return {
        title: 'Gewerkte uren · Bediening',
        intro: 'Bediening team gewerkte hours (plus half of Afwas per person).',
        summaryRows: [
          { label: 'Combined Bediening hours', value: formatHoursWhole(t.bedieningHours) },
        ],
        venueColumns: ['Hours', 'Wages', 'Bev €/h'],
        venueRows: [],
        venueSections: venueSectionsForGewerkt('bediening', (v) => [
          formatHoursWhole(v.labor.bediening.hours),
          formatEurWhole(v.labor.bediening.loaded),
          formatEurPerHourWhole(v.productivity.bedieningPerHour),
        ]),
      }
    case 'gewerktOverig':
      return {
        title: 'Gewerkte uren · Overig',
        intro: 'All hours minus gewerkt: Ziek, Management, Algemeen, HR, stock teams, etc.',
        summaryRows: [
          { label: 'Combined Overig hours', value: formatHoursWhole(t.otherHours) },
          { label: 'All hours (3 venues)', value: formatHoursWhole(t.gewerktHours + t.otherHours) },
        ],
        venueColumns: ['Hours', 'Wages', '% rev'],
        venueRows: [],
        venueSections: venueSectionsForGewerkt('overig', (v) => [
          formatHoursWhole(v.labor.other?.hours ?? 0),
          formatEurWhole(v.labor.other?.loaded ?? 0),
          formatPctWhole(v.labor.other?.laborPctOfRevenue ?? null),
        ]),
      }
    default:
      return empty
  }
})
</script>
