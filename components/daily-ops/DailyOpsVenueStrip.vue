<template>
  <section class="min-w-0 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="min-w-0 text-sm font-semibold uppercase tracking-wide text-gray-600">
        Locations ({{ periodLabel }})
      </h2>

      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <div
          v-if="hasVenues"
          class="hidden md:flex lg:hidden"
        >
          <UiPillTabs
            :model-value="mediumSlideIndex"
            :options="mediumVenuePillOptions"
            aria-label="Select venue slide"
            @update:model-value="goToPillSlide($event, 2)"
          />
        </div>

        <div
          v-if="hasVenues"
          class="flex md:hidden"
        >
          <UiPillTabs
            :model-value="smallSlideIndex"
            :options="smallVenuePillOptions"
            aria-label="Select venue slide"
            @update:model-value="goToPillSlide($event, 1)"
          />
        </div>

        <div
          class="relative z-0 inline-flex shrink-0 items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-0.5"
          role="group"
          aria-label="Venue strip view"
        >
          <button
            type="button"
            class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
            :class="viewMode === 'overview' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
            :aria-pressed="viewMode === 'overview'"
            title="Venue overview"
            @click="viewMode = 'overview'"
          >
            <UIcon name="i-lucide-gauge" class="size-4" aria-hidden="true" />
            <span class="sr-only">Overview</span>
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
            :class="viewMode === 'detail' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'"
            :aria-pressed="viewMode === 'detail'"
            title="Venue detail"
            @click="viewMode = 'detail'"
          >
            <UIcon name="i-lucide-list" class="size-4" aria-hidden="true" />
            <span class="sr-only">Detail</span>
          </button>
        </div>
      </div>
    </div>

    <UAlert
      v-if="fetchError"
      color="error"
      variant="soft"
      title="Could not load venue strip"
      :description="String(fetchError)"
    />

    <div
      v-else-if="pending"
      class="grid gap-4 lg:grid-cols-3"
    >
      <USkeleton v-for="i in 3" :key="i" class="h-96 w-full rounded-lg" />
    </div>

    <UAlert
      v-else-if="!hasVenues"
      color="neutral"
      variant="soft"
      title="No venue data"
      description="No snapshot data for this period yet. Try a shorter range or rebuild snapshots."
    />

    <!-- Overview — Desktop Grid (lg+) -->
    <div
      v-if="hasVenues"
      v-show="viewMode === 'overview'"
      class="hidden lg:grid min-w-0 gap-4 lg:grid-cols-3"
    >
      <div
        v-for="venue in data.venues"
        :key="`overview-${venue.locationId}`"
        class="min-w-0 space-y-2"
      >
        <h3
          class="text-base font-bold text-gray-900"
          :style="{ color: chartColorFor(venue.locationId) }"
        >
          {{ venue.locationName }}
        </h3>
        <DailyOpsVenueStripOverviewCard
          :venue="venue"
          :show-active="showActiveCounts"
          :leave-venue="attendanceVenue(venue.locationId, 'leave')"
          :sick-venue="attendanceVenue(venue.locationId, 'sick')"
        />
      </div>
    </div>

    <!-- Detail — Desktop Grid (lg+) -->
    <div
      v-if="hasVenues"
      v-show="viewMode === 'detail'"
      class="hidden lg:grid min-w-0 gap-4 lg:grid-cols-3"
    >
      <UCard
        v-for="venue in data.venues"
        :key="venue.locationId"
        class="border-2 !bg-white ring-0 shadow-none"
        :style="venueCardBorderStyle(venue.locationId)"
      >
        <h3 class="text-lg font-semibold text-gray-900">{{ venue.locationName }}</h3>

        <div class="mt-4 space-y-4 text-xs text-gray-700">
          <div>
            <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">Revenue</p>
            <dl class="space-y-1">
              <div class="flex justify-between gap-2">
                <dt>Total</dt>
                <dd class="tabular-nums font-semibold text-gray-900">
                  {{ formatEurWhole(venue.revenue.total) }}
                  <span class="ml-1 font-normal text-gray-400">{{ formatEurWhole(venue.revenue.totalIncVat ?? venue.revenue.total * 1.21) }}</span>
                </dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt>Food</dt>
                <dd class="tabular-nums">
                  {{ formatEurWhole(venue.revenue.food) }}
                  <span class="ml-1 font-normal text-gray-400">{{ formatEurWhole(venue.revenue.foodIncVat ?? venue.revenue.food * 1.21) }}</span>
                </dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt>Beverage</dt>
                <dd class="tabular-nums">
                  {{ formatEurWhole(venue.revenue.beverage) }}
                  <span class="ml-1 font-normal text-gray-400">{{ formatEurWhole(venue.revenue.beverageIncVat ?? venue.revenue.beverage * 1.21) }}</span>
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">Labor</p>
            <div class="space-y-2">
              <div
                v-for="row in laborRows(venue.labor)"
                :key="row.label"
                class="flex items-baseline justify-between gap-2 border-t border-gray-100 pt-1 first:border-t-0 first:pt-0"
              >
                <span class="text-gray-600">{{ row.label }}</span>
                <span class="shrink-0 text-right tabular-nums text-gray-900">
                  <span class="text-gray-600">{{ row.data.workers }} workers · {{ formatHours(row.data.hours) }} · </span>
                  <span class="font-semibold">{{ formatEurWhole(row.data.loaded) }}</span>
                  <span v-if="row.data.laborPctOfRevenue != null" class="text-gray-600">
                    · {{ formatPct(row.data.laborPctOfRevenue) }} rev
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div>
            <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">Productivity (€/h)</p>
            <dl class="space-y-1">
              <div class="flex justify-between gap-2">
                <dt>Total (rev / gewerkte h)</dt>
                <dd class="tabular-nums font-medium">{{ formatProductivity(venue.productivity.totalPerHour) }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt>Keuken (food / keuken h)</dt>
                <dd class="tabular-nums font-medium">{{ formatProductivity(venue.productivity.keukenPerHour) }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt>Bediening (bev / bediening h)</dt>
                <dd class="tabular-nums font-medium">{{ formatProductivity(venue.productivity.bedieningPerHour) }}</dd>
              </div>
            </dl>
          </div>

          <div>
            <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">Contracts</p>
            <div class="space-y-2">
              <div
                v-for="block in contractBlocks(venue.contractsByTeam)"
                :key="block.title"
              >
                <p class="text-gray-600">{{ block.title }}</p>
                <p v-if="!block.rows.length" class="text-gray-500">—</p>
                <ul v-else class="mt-0.5 space-y-0.5">
                  <li
                    v-for="(r, idx) in block.rows"
                    :key="`${r.contractType}-${idx}`"
                    class="grid grid-cols-[minmax(0,1.4fr)_auto_auto_auto] gap-x-2 tabular-nums text-gray-900"
                  >
                    <span class="truncate text-gray-600">{{ r.contractType }}</span>
                    <span class="inline-flex items-center justify-end gap-0.5 text-gray-600">
                      <span>{{ r.workers }}</span>
                      <UIcon name="i-lucide-user" class="size-3 shrink-0" aria-hidden="true" />
                    </span>
                    <span class="text-right">{{ formatHours(r.hours) }}</span>
                    <span class="text-right font-medium">{{ formatEurWhole(r.loaded) }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Overview — Medium Carousel (md, 2 visible + 1 to slide) -->
    <div v-if="hasVenues" v-show="viewMode === 'overview'" class="hidden md:block lg:hidden">
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
          <div
            v-for="venue in data.venues"
            :key="`overview-md-${venue.locationId}`"
            class="min-w-0 basis-[calc((100%-1rem)/2)] shrink-0 space-y-2"
          >
            <h3
              class="text-base font-bold text-gray-900"
              :style="{ color: chartColorFor(venue.locationId) }"
            >
              {{ venue.locationName }}
            </h3>
            <DailyOpsVenueStripOverviewCard
          :venue="venue"
          :show-active="showActiveCounts"
          :leave-venue="attendanceVenue(venue.locationId, 'leave')"
          :sick-venue="attendanceVenue(venue.locationId, 'sick')"
        />
          </div>
        </div>
      </div>
    </div>

    <!-- Detail — Medium Carousel (md, 2 visible + 1 to slide) -->
    <div v-if="hasVenues" v-show="viewMode === 'detail'" class="hidden md:block lg:hidden">
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
          <UCard
            v-for="venue in data.venues"
            :key="venue.locationId"
            class="basis-[calc((100%-1rem)/2)] flex-shrink-0 border-2 !bg-white ring-0 shadow-none"
            :style="venueCardBorderStyle(venue.locationId)"
          >
            <h3 class="text-lg font-semibold text-gray-900">{{ venue.locationName }}</h3>

            <div class="mt-4 space-y-4 text-xs text-gray-700">
              <div>
                <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">Revenue</p>
                <dl class="space-y-1">
                  <div class="flex justify-between gap-2">
                    <dt>Total</dt>
                    <dd class="tabular-nums font-semibold text-gray-900">
                      {{ formatEurWhole(venue.revenue.total) }}
                      <span class="ml-1 font-normal text-gray-400">{{ formatEurWhole(venue.revenue.totalIncVat ?? venue.revenue.total * 1.21) }}</span>
                    </dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt>Food</dt>
                    <dd class="tabular-nums">
                      {{ formatEurWhole(venue.revenue.food) }}
                      <span class="ml-1 font-normal text-gray-400">{{ formatEurWhole(venue.revenue.foodIncVat ?? venue.revenue.food * 1.21) }}</span>
                    </dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt>Beverage</dt>
                    <dd class="tabular-nums">
                      {{ formatEurWhole(venue.revenue.beverage) }}
                      <span class="ml-1 font-normal text-gray-400">{{ formatEurWhole(venue.revenue.beverageIncVat ?? venue.revenue.beverage * 1.21) }}</span>
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">Labor</p>
                <div class="space-y-2">
                  <div
                    v-for="row in laborRows(venue.labor)"
                    :key="row.label"
                    class="flex items-baseline justify-between gap-2 border-t border-gray-100 pt-1 first:border-t-0 first:pt-0"
                  >
                    <span class="text-gray-600">{{ row.label }}</span>
                    <span class="shrink-0 text-right tabular-nums text-gray-900">
                      <span class="text-gray-600">{{ row.data.workers }} workers · {{ formatHours(row.data.hours) }} · </span>
                      <span class="font-semibold">{{ formatEurWhole(row.data.loaded) }}</span>
                      <span v-if="row.data.laborPctOfRevenue != null" class="text-gray-600">
                        · {{ formatPct(row.data.laborPctOfRevenue) }} rev
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">Productivity (€/h)</p>
                <dl class="space-y-1">
                  <div class="flex justify-between gap-2">
                    <dt>Total (rev / gewerkte h)</dt>
                    <dd class="tabular-nums font-medium">{{ formatProductivity(venue.productivity.totalPerHour) }}</dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt>Keuken (food / keuken h)</dt>
                    <dd class="tabular-nums font-medium">{{ formatProductivity(venue.productivity.keukenPerHour) }}</dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt>Bediening (bev / bediening h)</dt>
                    <dd class="tabular-nums font-medium">{{ formatProductivity(venue.productivity.bedieningPerHour) }}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">Contracts</p>
                <div class="space-y-2">
                  <div
                    v-for="block in contractBlocks(venue.contractsByTeam)"
                    :key="block.title"
                  >
                    <p class="text-gray-600">{{ block.title }}</p>
                    <p v-if="!block.rows.length" class="text-gray-500">—</p>
                    <ul v-else class="mt-0.5 space-y-0.5">
                      <li
                        v-for="(r, idx) in block.rows"
                        :key="`${r.contractType}-${idx}`"
                        class="grid grid-cols-[minmax(0,1.4fr)_auto_auto_auto] gap-x-2 tabular-nums text-gray-900"
                      >
                        <span class="truncate text-gray-600">{{ r.contractType }}</span>
                        <span class="inline-flex items-center justify-end gap-0.5 text-gray-600">
                          <span>{{ r.workers }}</span>
                          <UIcon name="i-lucide-user" class="size-3 shrink-0" aria-hidden="true" />
                        </span>
                        <span class="text-right">{{ formatHours(r.hours) }}</span>
                        <span class="text-right font-medium">{{ formatEurWhole(r.loaded) }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>

    </div>


    <!-- Overview — Small Carousel (sm and below, 1 visible) -->
    <div v-if="hasVenues" v-show="viewMode === 'overview'" class="md:hidden">
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
          <div
            v-for="venue in data.venues"
            :key="`overview-sm-${venue.locationId}`"
            class="w-full shrink-0 space-y-2"
          >
            <h3
              class="text-base font-bold text-gray-900"
              :style="{ color: chartColorFor(venue.locationId) }"
            >
              {{ venue.locationName }}
            </h3>
            <DailyOpsVenueStripOverviewCard
          :venue="venue"
          :show-active="showActiveCounts"
          :leave-venue="attendanceVenue(venue.locationId, 'leave')"
          :sick-venue="attendanceVenue(venue.locationId, 'sick')"
        />
          </div>
        </div>
      </div>
    </div>

    <!-- Detail — Small Carousel (sm and below, 1 visible) -->
    <div v-if="hasVenues" v-show="viewMode === 'detail'" class="md:hidden">
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
          <UCard
            v-for="venue in data.venues"
            :key="venue.locationId"
            class="w-full flex-shrink-0 border-2 !bg-white ring-0 shadow-none"
            :style="venueCardBorderStyle(venue.locationId)"
          >
            <h3 class="text-lg font-semibold text-gray-900">{{ venue.locationName }}</h3>

            <div class="mt-4 space-y-4 text-xs text-gray-700">
              <div>
                <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">Revenue</p>
                <dl class="space-y-1">
                  <div class="flex justify-between gap-2">
                    <dt>Total</dt>
                    <dd class="tabular-nums font-semibold text-gray-900">
                      {{ formatEurWhole(venue.revenue.total) }}
                      <span class="ml-1 font-normal text-gray-400">{{ formatEurWhole(venue.revenue.totalIncVat ?? venue.revenue.total * 1.21) }}</span>
                    </dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt>Food</dt>
                    <dd class="tabular-nums">
                      {{ formatEurWhole(venue.revenue.food) }}
                      <span class="ml-1 font-normal text-gray-400">{{ formatEurWhole(venue.revenue.foodIncVat ?? venue.revenue.food * 1.21) }}</span>
                    </dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt>Beverage</dt>
                    <dd class="tabular-nums">
                      {{ formatEurWhole(venue.revenue.beverage) }}
                      <span class="ml-1 font-normal text-gray-400">{{ formatEurWhole(venue.revenue.beverageIncVat ?? venue.revenue.beverage * 1.21) }}</span>
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">Labor</p>
                <div class="space-y-2">
                  <div
                    v-for="row in laborRows(venue.labor)"
                    :key="row.label"
                    class="flex items-baseline justify-between gap-2 border-t border-gray-100 pt-1 first:border-t-0 first:pt-0"
                  >
                    <span class="text-gray-600">{{ row.label }}</span>
                    <span class="shrink-0 text-right tabular-nums text-gray-900">
                      <span class="text-gray-600">{{ row.data.workers }} workers · {{ formatHours(row.data.hours) }} · </span>
                      <span class="font-semibold">{{ formatEurWhole(row.data.loaded) }}</span>
                      <span v-if="row.data.laborPctOfRevenue != null" class="text-gray-600">
                        · {{ formatPct(row.data.laborPctOfRevenue) }} rev
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">Productivity (€/h)</p>
                <dl class="space-y-1">
                  <div class="flex justify-between gap-2">
                    <dt>Total (rev / gewerkte h)</dt>
                    <dd class="tabular-nums font-medium">{{ formatProductivity(venue.productivity.totalPerHour) }}</dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt>Keuken (food / keuken h)</dt>
                    <dd class="tabular-nums font-medium">{{ formatProductivity(venue.productivity.keukenPerHour) }}</dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt>Bediening (bev / bediening h)</dt>
                    <dd class="tabular-nums font-medium">{{ formatProductivity(venue.productivity.bedieningPerHour) }}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <p class="mb-1 text-xs font-bold uppercase tracking-wide text-gray-900">Contracts</p>
                <div class="space-y-2">
                  <div
                    v-for="block in contractBlocks(venue.contractsByTeam)"
                    :key="block.title"
                  >
                    <p class="text-gray-600">{{ block.title }}</p>
                    <p v-if="!block.rows.length" class="text-gray-500">—</p>
                    <ul v-else class="mt-0.5 space-y-0.5">
                      <li
                        v-for="(r, idx) in block.rows"
                        :key="`${r.contractType}-${idx}`"
                        class="grid grid-cols-[minmax(0,1.4fr)_auto_auto_auto] gap-x-2 tabular-nums text-gray-900"
                      >
                        <span class="truncate text-gray-600">{{ r.contractType }}</span>
                        <span class="inline-flex items-center justify-end gap-0.5 text-gray-600">
                          <span>{{ r.workers }}</span>
                          <UIcon name="i-lucide-user" class="size-3 shrink-0" aria-hidden="true" />
                        </span>
                        <span class="text-right">{{ formatHours(r.hours) }}</span>
                        <span class="text-right font-medium">{{ formatEurWhole(r.loaded) }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>

    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  DailyOpsPeriodId,
  VenueStripCardDto,
  VenueStripContractRowDto,
  VenueStripLaborRowDto,
  VenueStripResponseDto,
  DailyOpsAttendanceKpisDto,
  DailyOpsAttendanceVenueDto,
} from '~/types/daily-ops-dashboard'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'
import { weekdayShortForYmd } from '~/utils/inbox/importTableQuickDates'

const props = defineProps<{
  period: DailyOpsPeriodId
  anchor?: string | null
}>()

const { chartColorFor } = useDailyOpsLocationChartColors()

function venueCardBorderStyle(locationId: string) {
  return { borderColor: chartColorFor(locationId) }
}

type VenuePillOption = { value: number; label: string; key: string }
type PillTabValue = string | number

type VenueStripViewMode = 'overview' | 'detail'

const viewMode = ref<VenueStripViewMode>('overview')
const currentSlide = ref(0)
const swipeStartX = ref<number | null>(null)
const swipeStartY = ref<number | null>(null)
const swipeThresholdPx = 50
const wheelDeltaX = ref(0)
const wheelLastSlideAt = ref(0)
const wheelThresholdPx = 35
const wheelCooldownMs = 450
const venueShortLabelsByName: Record<string, string> = {
  'Van Kinsbergen': 'VKB',
  'Bar Bea': 'BEA',
  "l'Amour Toujours": 'LAT',
}

const eurWholeFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatEurWhole (value: number): string {
  return eurWholeFormatter.format(Math.round(value))
}

function formatHours (value: number): string {
  return `${Math.round(value)} h`
}

function formatPct (value: number): string {
  return `${Math.round(value)}%`
}

const RANGE_PERIOD_LABELS: Partial<Record<DailyOpsPeriodId, string>> = {
  'this-week': 'This week',
  'last-week': 'Last week',
  'this-month': 'This month',
  'last-month': 'Last month',
  'this-year': 'This year',
  'last-year': 'Last year',
}

const periodLabel = computed(() => {
  if (props.period === 'today') return 'Today'
  if (props.period === 'yesterday') return 'Yesterday'
  if (/^d[2-7]$/.test(props.period)) {
    const r = resolveDailyOpsPeriod(props.period, props.anchor ?? undefined)
    return weekdayShortForYmd(r.startDate)
  }
  return RANGE_PERIOD_LABELS[props.period] ?? props.period
})

const stripQuery = computed(() => {
  const q: Record<string, string> = { period: props.period }
  if (props.anchor) q.anchor = props.anchor
  return q
})

const cacheKey = computed(
  () => `daily-ops-venue-strip-${props.period}-${props.anchor ?? ''}`
)

const { data, pending, error: fetchError } = useAsyncData(
  cacheKey,
  async (): Promise<VenueStripResponseDto | null> =>
    await $fetch<VenueStripResponseDto>('/api/daily-ops/metrics/venue-strip', {
      query: stripQuery.value,
    }),
  { watch: [cacheKey] }
)

const attendanceCacheKey = computed(
  () => `daily-ops-attendance-kpis-${props.period}-${props.anchor ?? ''}`,
)

const { data: attendanceData } = useAsyncData(
  attendanceCacheKey,
  async (): Promise<DailyOpsAttendanceKpisDto | null> =>
    await $fetch<DailyOpsAttendanceKpisDto>('/api/daily-ops/metrics/attendance-kpis', {
      query: stripQuery.value,
    }),
  { watch: [attendanceCacheKey] },
)

function attendanceVenue(
  locationId: string,
  kind: 'leave' | 'sick',
): DailyOpsAttendanceVenueDto | null {
  const block = kind === 'leave' ? attendanceData.value?.leave : attendanceData.value?.sick
  return block?.venues.find((v) => v.locationId === locationId) ?? null
}

const hasVenues = computed(() => (data.value?.venues?.length ?? 0) > 0)
const showActiveCounts = computed(() => props.period === 'today')

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
  const venueCount = data.value?.venues?.length ?? 0
  return Math.max(venueCount - visibleCardCount, 0)
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
  const venues: VenueStripCardDto[] = data.value?.venues ?? []
  return venues.map((venue: VenueStripCardDto, idx: number) => ({
    value: clampSlideIndex(idx, visibleCardCount),
    label: venueShortLabel(venue.locationName),
    key: venue.locationId,
  }))
}

function venueShortLabel (locationName: string): string {
  return venueShortLabelsByName[locationName] ?? locationName.slice(0, 3).toUpperCase()
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

function formatProductivity (v: number | null): string {
  if (v == null) return '—'
  return `${formatEurWhole(v)}/h`
}

function laborRows (labor: VenueStripCardDto['labor']): { label: string; data: VenueStripLaborRowDto }[] {
  return [
    { label: 'Total (all hours)', data: labor.all },
    { label: 'Gewerkte uren', data: labor.gewerkt },
    { label: 'Keuken', data: labor.keuken },
    { label: 'Bediening', data: labor.bediening },
  ]
}

function contractBlocks (contracts: VenueStripCardDto['contractsByTeam']): {
  title: string
  rows: VenueStripContractRowDto[]
}[] {
  return [
    { title: 'Keuken', rows: contracts.keuken },
    { title: 'Bediening', rows: contracts.bediening },
    { title: 'Other', rows: contracts.other },
  ]
}
</script>
