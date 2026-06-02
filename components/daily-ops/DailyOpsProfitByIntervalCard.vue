<template>
  <section
    v-if="hasData"
    class="min-w-0 space-y-3"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="min-w-0 text-sm font-semibold uppercase tracking-wide text-gray-600">
        Profit by time of day ({{ periodTitle }})
      </h2>

      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <template v-if="viewMode === 'cards'">
          <div class="hidden md:flex lg:hidden">
            <UiPillTabs
              :model-value="mediumSlideIndex"
              :options="mediumVenuePillOptions"
              aria-label="Select venue slide"
              @update:model-value="goToPillSlide($event, 2)"
            />
          </div>

          <div class="flex md:hidden">
            <UiPillTabs
              :model-value="smallSlideIndex"
              :options="smallVenuePillOptions"
              aria-label="Select venue slide"
              @update:model-value="goToPillSlide($event, 1)"
            />
          </div>
        </template>

        <div
          class="relative z-0 inline-flex shrink-0 flex-wrap items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-0.5"
          role="group"
          aria-label="Profit by interval view"
        >
          <button
            type="button"
            class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
            :class="viewMode === 'cards' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
            :aria-pressed="viewMode === 'cards'"
            title="Location cards"
            @click="viewMode = 'cards'"
          >
            <UIcon name="i-lucide-layout-grid" class="size-4" aria-hidden="true" />
            <span class="sr-only">Cards</span>
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
            :class="viewMode === 'chart' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
            :aria-pressed="viewMode === 'chart'"
            title="Pie charts"
            @click="viewMode = 'chart'"
          >
            <UIcon name="i-lucide-chart-pie" class="size-4" aria-hidden="true" />
            <span class="sr-only">Pie charts</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Desktop grid (lg+) -->
    <div
      v-show="viewMode === 'cards'"
      class="hidden min-w-0 gap-4 lg:grid lg:grid-cols-3"
    >
      <DailyOpsProfitIntervalVenueCard
        v-for="loc in venueLocations"
        :key="loc.locationId"
        :location-id="loc.locationId"
        :label="loc.label"
        :period-title="periodTitle"
        :data="data"
      />
    </div>

    <!-- Medium carousel (md, 2 visible) -->
    <div v-show="viewMode === 'cards'" class="hidden md:block lg:hidden">
      <div
        class="flex touch-pan-y overscroll-x-contain overflow-hidden rounded-lg"
        @pointerdown="startSwipe"
        @pointerup="finishSwipe($event, 2)"
        @pointercancel="resetSwipe"
        @wheel="handleWheel($event, 2)"
      >
        <div
          class="flex w-full shrink-0 gap-4 transition-transform duration-300 ease-out"
          :style="{ transform: mediumTrackTransform }"
        >
          <DailyOpsProfitIntervalVenueCard
            v-for="loc in venueLocations"
            :key="loc.locationId"
            :location-id="loc.locationId"
            :label="loc.label"
            :period-title="periodTitle"
            :data="data"
            card-class="basis-[calc((100%-1rem)/2)] flex-shrink-0"
          />
        </div>
      </div>
    </div>

    <!-- Small carousel (xs/sm, 1 visible) -->
    <div v-show="viewMode === 'cards'" class="md:hidden">
      <div
        class="flex touch-pan-y overscroll-x-contain overflow-hidden rounded-lg"
        @pointerdown="startSwipe"
        @pointerup="finishSwipe($event, 1)"
        @pointercancel="resetSwipe"
        @wheel="handleWheel($event, 1)"
      >
        <div
          class="flex w-full shrink-0 gap-4 transition-transform duration-300 ease-out"
          :style="{ transform: smallTrackTransform }"
        >
          <DailyOpsProfitIntervalVenueCard
            v-for="loc in venueLocations"
            :key="loc.locationId"
            :location-id="loc.locationId"
            :label="loc.label"
            :period-title="periodTitle"
            :data="data"
            card-class="w-full flex-shrink-0"
          />
        </div>
      </div>
    </div>

    <div
      v-show="viewMode === 'chart'"
      class="rounded-lg border-2 border-gray-900 bg-white p-4"
    >
      <div class="grid min-w-0 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <DailyOpsProfitIntervalDonut
          v-for="panel in donutPanels"
          :key="panel.key"
          :title="panel.title"
          :total-revenue="panel.totalRevenue"
          :total-profit="panel.totalProfit"
          :slices="panel.slices"
        />
      </div>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-600">
        <span class="inline-flex items-center gap-1.5">
          <span
            class="size-3 shrink-0 rounded-full border-2"
            :style="{ borderColor: statusRingColors.positive }"
          />
          Positive day profit (ring)
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span
            class="size-3 shrink-0 rounded-full border-2"
            :style="{ borderColor: statusRingColors.negative }"
          />
          Negative day profit (ring)
        </span>
        <span
          v-for="def in DAILY_OPS_PROFIT_INTERVALS"
          :key="def.key"
          class="inline-flex items-center gap-1.5"
        >
          <span
            class="size-2.5 shrink-0 rounded-full"
            :style="{ backgroundColor: intervalColors[def.key] }"
          />
          {{ def.label }} (profit slice)
        </span>
      </div>
    </div>

    <p class="text-[11px] leading-snug text-gray-500">
      {{ data.estimatesNote }}
      <span class="text-gray-400"> · </span>
      Each donut shows <span class="font-medium text-gray-700">estimated profit by time of day</span> (Lunch, Afternoon, Dinner, Late Night).
      <span class="font-medium text-gray-700">Revenue</span> above each chart matches the venue strip headline total for that location.
      Legend amounts are <span class="font-medium text-gray-700">profit per interval</span> (with % of the day’s profit mix); slice size uses absolute profit.
      The <span class="font-medium text-gray-700">outer ring</span> is green when day profit is positive, red when negative.
      Lunch 08:00–16:00 · Afternoon 16:00–18:00 · Dinner 18:00–22:00 · Late Night 22:00 until close.
    </p>
  </section>
</template>

<script setup lang="ts">
import type {
  DailyOpsPeriodId,
  DailyOpsProfitByIntervalDto,
  DailyOpsProfitIntervalKey,
} from '~/types/daily-ops-dashboard'
import {
  DAILY_OPS_PROFIT_INTERVALS,
  DAILY_OPS_PROFIT_INTERVAL_CHART_COLORS,
  DAILY_OPS_PROFIT_STATUS_RING,
  DAILY_OPS_PROFIT_VENUE_LOCATIONS,
  type DailyOpsProfitIntervalKpiKey,
  type ProfitIntervalSlice,
} from '~/utils/dailyOpsProfitIntervals'

const statusRingColors = DAILY_OPS_PROFIT_STATUS_RING
const intervalColors = DAILY_OPS_PROFIT_INTERVAL_CHART_COLORS

const props = defineProps<{
  data: DailyOpsProfitByIntervalDto
  period: DailyOpsPeriodId
}>()

const hasData = computed(
  () => Array.isArray(props.data?.cells) && props.data.cells.length > 0,
)

const viewMode = ref<'cards' | 'chart'>('chart')

type VenuePillOption = { value: number; label: string; key: string }
type PillTabValue = string | number

const currentSlide = ref(0)
const swipeStartX = ref<number | null>(null)
const swipeStartY = ref<number | null>(null)
const swipeThresholdPx = 50
const wheelDeltaX = ref(0)
const wheelLastSlideAt = ref(0)
const wheelThresholdPx = 35
const wheelCooldownMs = 450

const venueLocations = DAILY_OPS_PROFIT_VENUE_LOCATIONS

const mediumSlideIndex = computed(() => clampSlideIndex(currentSlide.value, 2))
const smallSlideIndex = computed(() => clampSlideIndex(currentSlide.value, 1))
const mediumVenuePillOptions = computed(() => venuePillOptions(2))
const smallVenuePillOptions = computed(() => venuePillOptions(1))
const mediumTrackTransform = computed(() => (
  mediumSlideIndex.value === 0 ? 'translateX(0)' : 'translateX(calc(-50% - 0.5rem))'
))
const smallTrackTransform = computed(() => (
  `translateX(calc(-${smallSlideIndex.value * 100}% - ${smallSlideIndex.value}rem))`
))

function maxSlideIndex (visibleCardCount: number): number {
  return Math.max(venueLocations.length - visibleCardCount, 0)
}

function clampSlideIndex (index: number, visibleCardCount: number): number {
  return Math.min(Math.max(index, 0), maxSlideIndex(visibleCardCount))
}

function goToSlide (index: number, visibleCardCount: number): void {
  currentSlide.value = clampSlideIndex(index, visibleCardCount)
}

function goToPillSlide (value: PillTabValue, visibleCardCount: number): void {
  if (typeof value !== 'number') return
  goToSlide(value, visibleCardCount)
}

function venuePillOptions (visibleCardCount: number): VenuePillOption[] {
  return venueLocations.map((loc, idx) => ({
    value: clampSlideIndex(idx, visibleCardCount),
    label: loc.short,
    key: loc.locationId,
  }))
}

function startSwipe (event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const target = event.currentTarget
  if (target instanceof HTMLElement) target.setPointerCapture(event.pointerId)
  swipeStartX.value = event.clientX
  swipeStartY.value = event.clientY
}

function finishSwipe (event: PointerEvent, visibleCardCount: number): void {
  if (swipeStartX.value == null || swipeStartY.value == null) return
  const target = event.currentTarget
  if (target instanceof HTMLElement && target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }

  const deltaX = event.clientX - swipeStartX.value
  const deltaY = event.clientY - swipeStartY.value

  resetSwipe()

  if (Math.abs(deltaX) < swipeThresholdPx || Math.abs(deltaX) < Math.abs(deltaY)) return

  const direction = deltaX < 0 ? 1 : -1
  goToSlide(clampSlideIndex(currentSlide.value, visibleCardCount) + direction, visibleCardCount)
}

function handleWheel (event: WheelEvent, visibleCardCount: number): void {
  const deltaX = Math.abs(event.deltaX) > Math.abs(event.deltaY)
    ? event.deltaX
    : event.shiftKey
      ? event.deltaY
      : 0

  if (deltaX === 0) return

  event.preventDefault()

  const now = Date.now()
  if (now - wheelLastSlideAt.value < wheelCooldownMs) return

  if (wheelDeltaX.value !== 0 && Math.sign(wheelDeltaX.value) !== Math.sign(deltaX)) {
    wheelDeltaX.value = 0
  }

  wheelDeltaX.value += deltaX
  if (Math.abs(wheelDeltaX.value) < wheelThresholdPx) return

  const direction = wheelDeltaX.value > 0 ? 1 : -1
  goToSlide(clampSlideIndex(currentSlide.value, visibleCardCount) + direction, visibleCardCount)
  wheelDeltaX.value = 0
  wheelLastSlideAt.value = now
}

function resetSwipe (): void {
  swipeStartX.value = null
  swipeStartY.value = null
}

const periodTitle = computed(() => {
  if (props.period === 'today') return 'Today'
  if (props.period === 'yesterday') return 'Yesterday'
  if (props.period === 'this-week') return 'This week'
  if (props.period === 'last-week') return 'Last week'
  return props.period
})

const pieLocationDefs = [
  { key: 'all', locationId: null as string | null, title: 'All locations' },
  ...DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => ({
    key: v.locationId,
    locationId: v.locationId,
    title: v.label,
  })),
]

function kpiValue (
  locationId: string | null,
  intervalKey: DailyOpsProfitIntervalKey,
  kpiKey: DailyOpsProfitIntervalKpiKey
): number {
  const cells = props.data?.cells ?? []
  const dates = props.data?.dates ?? []
  return cells
    .filter(
      (c) =>
        (c.locationId ?? null) === locationId &&
        c.intervalKey === intervalKey &&
        dates.includes(c.date),
    )
    .reduce((sum, c) => sum + (c[kpiKey] ?? 0), 0)
}

function locationTotalKpi (
  locationId: string | null,
  kpiKey: DailyOpsProfitIntervalKpiKey
): number {
  return DAILY_OPS_PROFIT_INTERVALS.reduce(
    (sum, def) => sum + kpiValue(locationId, def.key, kpiKey),
    0,
  )
}

function hasAnyIntervalData (locationId: string | null, intervalKey: DailyOpsProfitIntervalKey): boolean {
  return (props.data?.cells ?? []).some(
    (c) =>
      (c.locationId ?? null) === locationId &&
      c.intervalKey === intervalKey &&
      (props.data?.dates ?? []).includes(c.date),
  )
}

type DonutPanel = {
  key: string
  title: string
  totalRevenue: number
  totalProfit: number
  slices: ProfitIntervalSlice[]
}

const donutPanels = computed((): DonutPanel[] => {
  return pieLocationDefs.map((loc) => {
    const slices: ProfitIntervalSlice[] = DAILY_OPS_PROFIT_INTERVALS.map((def) => ({
      key: def.key,
      label: def.label,
      profit: kpiValue(loc.locationId, def.key, 'profit'),
      hasData: hasAnyIntervalData(loc.locationId, def.key),
    }))
    const totalProfit = slices.reduce((sum, s) => sum + s.profit, 0)
    const totalRevenue = locationTotalKpi(loc.locationId, 'revenue')
    return {
      key: loc.key,
      title: loc.title,
      totalRevenue,
      totalProfit,
      slices,
    }
  })
})
</script>
