<template>
  <div class="min-w-0">
    <div class="sticky top-3 z-10 mb-4 flex w-full min-w-0 flex-col items-end gap-2">
        <div class="flex w-full min-w-0 justify-end">
          <nav
            ref="sectionNavEl"
            aria-label="Daily Ops sections"
            class="scrollbar-hide inline-flex w-11/12 min-w-0 shrink-0 flex-nowrap gap-1 overflow-x-auto rounded-md border-2 border-gray-900 bg-white p-1 md:w-auto"
          >
            <NuxtLink
              v-for="item in navItems"
              :key="item.key"
              :to="{ path: item.path, query: dashboardQuery }"
              class="inline-flex shrink-0 items-center rounded px-4 py-2 text-sm font-semibold no-underline transition-colors"
              :class="activeNav === item.key
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-100'"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>
        </div>

        <DailyOpsRevenueNavV2RevenueAnalyticsNavV2 v-if="isRevenueRoute && revenueNavV2" />
        <DailyOpsRevenueAnalyticsNav v-else-if="isRevenueRoute" />

        <div v-if="!hideOpsPeriodNav" class="flex w-full min-w-0 justify-end">
          <nav
            ref="periodNavEl"
            aria-label="Daily Ops period"
            class="scrollbar-hide inline-flex w-9/12 min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-md border-2 border-gray-900 bg-white p-1 sm:w-10/12 md:w-auto"
          >
            <button
              v-for="opt in periodOptions"
              :key="opt.id"
              type="button"
              class="inline-flex shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors"
              :class="isDayPeriodActive(opt.id)
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-100'"
              :aria-current="isDayPeriodActive(opt.id) ? 'page' : undefined"
              @click="setPeriod(opt.id)"
            >
              {{ opt.label }}
            </button>
          </nav>
        </div>

        <div v-if="showRangePeriodNav && !hideOpsPeriodNav" class="flex w-full min-w-0 justify-end">
          <nav
            aria-label="Daily Ops range period"
            :style="rangeNavWidthPx > 0 ? { width: `${rangeNavWidthPx}px` } : undefined"
            class="scrollbar-hide inline-flex min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-md border-2 border-gray-900 bg-white p-1"
          >
            <button
              v-for="opt in rangePeriodOptions"
              :key="opt.id"
              type="button"
              class="inline-flex shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors"
              :class="isRangePeriodActive(opt.id)
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-100'"
              :aria-current="isRangePeriodActive(opt.id) ? 'page' : undefined"
              @click="setPeriod(opt.id)"
            >
              {{ opt.label }}
            </button>
          </nav>
        </div>

        <div v-if="showLocationShortcuts" class="flex w-full min-w-0 justify-end">
          <nav
            aria-label="Location shortcuts"
            class="scrollbar-hide inline-flex w-max max-w-full min-w-0 shrink-0 flex-nowrap gap-1 overflow-x-auto rounded-md border-2 border-gray-900 bg-white p-1"
          >
            <button
              type="button"
              class="rounded px-3 py-1.5 text-sm font-semibold transition-colors"
              :class="!locationId
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-100'"
              @click="setLocation(null)"
            >
              All
            </button>
          <button
            v-for="s in resolvedLocationShortcuts"
            :key="s.abbrev"
            type="button"
            class="rounded px-3 py-1.5 text-sm font-semibold transition-colors"
            :class="locationId === s.id
              ? 'bg-gray-900 text-white'
              : 'text-gray-700 hover:bg-gray-100'"
            :aria-label="`${s.longLabel}, ${s.abbrev}`"
            @click="s.id != null && setLocation(s.id)"
          >
            <span class="md:hidden">{{ s.abbrev }}</span>
            <span class="hidden md:inline">{{ s.longLabel }}</span>
          </button>
          </nav>
        </div>
    </div>

    <div class="min-w-0">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DailyOpsPeriodId } from '~/types/daily-ops-dashboard'
import {
  DAILY_OPS_DAY_PERIOD_IDS,
  DAILY_OPS_RANGE_PERIOD_IDS,
} from '~/types/daily-ops-dashboard'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { weekdayShortForYmd } from '~/utils/inbox/importTableQuickDates'

const props = withDefaults(
  defineProps<{
    /** Week/month/year range nav — Daily Ops overview page only. */
    showRangePeriodNav?: boolean
  }>(),
  { showRangePeriodNav: false },
)

const DAY_PERIOD_SET = new Set<string>(DAILY_OPS_DAY_PERIOD_IDS)
const RANGE_PERIOD_SET = new Set<string>(DAILY_OPS_RANGE_PERIOD_IDS)

type LocationRow = { _id: string; name: string; abbreviation?: string; chartColor?: string }

/** Set true to restore fixed location filter (All / Van Kinsbergen / Bar Bea / L'amour). */
const showLocationShortcuts = false

const DAILY_OPS_SHORTCUT_ABBREVS = ['VKB', 'BEA', 'LAT'] as const

function unifiedRowMatchesShortcut(row: LocationRow, abbrev: string): boolean {
  const a = abbrev.toUpperCase()
  if (row.abbreviation?.toUpperCase() === a) return true
  const n = row.name.toLowerCase()
  if (a === 'VKB') return /kinsbergen/i.test(n)
  if (a === 'BEA') {
    const c = n.replace(/\s+/g, '')
    return (c.includes('bar') && c.includes('bea')) || c.includes('barbea')
  }
  if (a === 'LAT') {
    if (/amour/.test(n) && /toujours/.test(n)) return true
    return n.replace(/[\s']/g, '') === 'lamour'
  }
  return false
}

const route = useRoute()

const sectionNavEl = ref<HTMLElement | null>(null)
const sectionNavWidthPx = ref(0)
const periodNavEl = ref<HTMLElement | null>(null)
const rangeNavWidthPx = ref(0)

function measureSectionNavWidth() {
  sectionNavWidthPx.value = sectionNavEl.value?.offsetWidth ?? 0
}

function measurePeriodNavWidth() {
  const w = periodNavEl.value?.offsetWidth ?? 0
  rangeNavWidthPx.value = w > 0 ? Math.round(w * 0.8) : 0
}

let sectionNavResizeObserver: ResizeObserver | undefined
let periodNavResizeObserver: ResizeObserver | undefined

onMounted(() => {
  measureSectionNavWidth()
  if (typeof ResizeObserver !== 'undefined' && sectionNavEl.value) {
    sectionNavResizeObserver = new ResizeObserver(measureSectionNavWidth)
    sectionNavResizeObserver.observe(sectionNavEl.value)
  }
  measurePeriodNavWidth()
  if (typeof ResizeObserver !== 'undefined' && periodNavEl.value) {
    periodNavResizeObserver = new ResizeObserver(measurePeriodNavWidth)
    periodNavResizeObserver.observe(periodNavEl.value)
  }
})

onUnmounted(() => {
  sectionNavResizeObserver?.disconnect()
  periodNavResizeObserver?.disconnect()
})

provide('dailyOpsSectionNavWidthPx', sectionNavWidthPx)

const isRevenueRoute = computed(() => route.path.includes('/daily-ops/revenue'))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const revenueNavV2 = (useRuntimeConfig() as any).public?.revenueNavVersion === 'v2'

watch(isRevenueRoute, () => {
  nextTick(() => {
    measureSectionNavWidth()
    measurePeriodNavWidth()
  })
})
watch(() => props.showRangePeriodNav, () => nextTick(measurePeriodNavWidth))
const hideOpsPeriodNav = computed(() => isRevenueRoute.value)

const {
  period,
  locationId,
  dashboardQuery,
  activeNav,
  setPeriod,
  setLocation,
} = useDailyOpsDashboardRoute()

const anchorYmd = computed(() => amsterdamOpenRegisterBusinessDateYmd())

/** Today · Yesterday · (weekday labels for open register day −2 … −7). */
const periodOptions = computed((): { id: DailyOpsPeriodId; label: string }[] => {
  const open = anchorYmd.value
  const rolling = ([2, 3, 4, 5, 6, 7] as const).map((off) => ({
    id: `d${off}` as DailyOpsPeriodId,
    label: weekdayShortForYmd(addCalendarDaysYmd(open, -off), 'en-GB'),
  }))
  return [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    ...rolling,
  ]
})

watch(periodOptions, () => nextTick(measurePeriodNavWidth))

const rangePeriodOptions: { id: DailyOpsPeriodId; label: string }[] = [
  { id: 'this-week', label: 'This week' },
  { id: 'last-week', label: 'Last week' },
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'this-year', label: 'This year' },
  { id: 'last-year', label: 'Last year' },
]

function isDayPeriodActive(id: DailyOpsPeriodId): boolean {
  return period.value === id && DAY_PERIOD_SET.has(period.value)
}

function isRangePeriodActive(id: DailyOpsPeriodId): boolean {
  return period.value === id && RANGE_PERIOD_SET.has(period.value)
}

const navItems = computed(() => {
  const prefix = '/daily-ops'
  return [
    { key: 'overview' as const, label: 'Daily Ops', path: prefix },
    { key: 'revenue' as const, label: 'Revenue', path: `${prefix}/revenue` },
    { key: 'productivity' as const, label: 'Productivity', path: `${prefix}/productivity` },
    { key: 'products' as const, label: 'Products', path: `${prefix}/products` },
    { key: 'insights' as const, label: 'Insights', path: `${prefix}/insights` },
    { key: 'inbox' as const, label: 'Inbox', path: `${prefix}/inbox` },
  ]
})

const { data: locationsRes } = useFetch<{ success: boolean; data: LocationRow[] }>(
  '/api/daily-ops/locations',
  { key: 'daily-ops-locations' },
)

const resolvedLocationShortcuts = computed(() => {
  const rows = locationsRes.value?.data ?? []
  return DAILY_OPS_SHORTCUT_ABBREVS.map((abbrev) => {
    const row = rows.find((l: LocationRow) => unifiedRowMatchesShortcut(l, abbrev))
    return {
      abbrev,
      longLabel: row?.name ?? abbrev,
      id: row?._id ?? null,
    }
  })
})
</script>
