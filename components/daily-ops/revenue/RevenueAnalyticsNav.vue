<template>
  <div class="flex w-full min-w-0 max-w-full flex-col items-end gap-2">
    <!-- Locations -->
    <div class="flex w-full min-w-0 justify-end">
      <nav
        aria-label="Revenue location"
        :class="navBarBase"
      >
        <button
          v-for="loc in REVENUE_LOCATIONS"
          :key="loc.abbrev"
          type="button"
          class="shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="navBtnClass((locationId ?? null) === loc.id)"
          @click="setLocation(loc.id)"
        >
          <span class="md:hidden">{{ loc.abbrev }}</span>
          <span class="hidden md:inline">{{ loc.abbrev === 'All' ? 'All' : loc.label }}</span>
        </button>
      </nav>
    </div>

    <!-- Spaces -->
    <div
      v-if="locationId && spaceOptions.length"
      class="flex w-full min-w-0 justify-end"
    >
      <nav
        aria-label="Revenue space"
        :class="navBarBase"
      >
        <button
          type="button"
          class="shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="navBtnClass(!locationSpace)"
          @click="setLocationSpace(null)"
        >
          All
        </button>
        <button
          v-for="sp in spaceOptions"
          :key="sp.id"
          type="button"
          class="shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="navBtnClass(locationSpace === sp.id)"
          @click="setLocationSpace(sp.id)"
        >
          {{ sp.label }}
        </button>
      </nav>
    </div>

    <!-- Period selects + compare: flex only, no box; w-max so justify-end does not clip left -->
    <div class="flex w-full min-w-0 justify-end">
      <div
        role="group"
        aria-label="Revenue filters"
        class="flex w-max max-w-full flex-wrap items-center justify-end gap-1"
      >
      <div
        v-for="group in REVENUE_PERIOD_GROUPS"
        :key="group.id"
        class="relative shrink-0"
        :class="selectMinWidthClass(group.id)"
      >
        <select
          :value="groupSelectValue(group.id)"
          :class="periodSelectClass(group.id)"
          :aria-label="group.label"
          @change="onGroupPeriodChange(group.id, $event)"
        >
          <option
            v-for="opt in group.options"
            :key="opt.id"
            :value="opt.id"
          >
            {{ opt.label }}
          </option>
        </select>
        <UIcon
          name="i-lucide-chevron-down"
          class="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2"
          :class="groupPeriodActive(group.id) ? 'text-white' : 'text-gray-900'"
          aria-hidden="true"
        />
      </div>
      <button
        type="button"
        class="shrink-0"
        :class="[pillBase, filterPillClass(compareEnabled || compareOpen)]"
        @click="toggleCompare"
      >
        {{ compareEnabled ? 'Vergelijking aan' : 'Vergelijk' }}
      </button>
      </div>
    </div>

    <!-- Compare panel -->
    <div
      v-if="compareOpen"
      class="w-max max-w-full rounded-md border border-gray-300 bg-white p-3 shadow-sm"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <p class="text-xs font-bold uppercase text-gray-700">Periode A</p>
          <p class="mt-1 text-sm text-gray-600">
            {{ primaryRange.label }} · {{ locationLabel(locationId) }}
            <span v-if="locationSpace"> · {{ spaceLabel(locationSpace) }}</span>
          </p>
          <p class="text-xs tabular-nums text-gray-500">
            {{ primaryRange.startDate }} – {{ primaryRange.endDate }}
          </p>
        </div>
        <div class="space-y-2">
          <p class="text-xs font-bold uppercase text-gray-700">Periode B</p>
          <select
            :value="draftComparePeriod"
            class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            @change="onComparePeriodChange"
          >
            <option
              v-for="opt in allPeriodOptions"
              :key="opt.id"
              :value="opt.id"
            >
              {{ opt.label }}
            </option>
          </select>
          <select
            :value="draftCompareLocation ?? ''"
            class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            @change="onCompareLocationChange"
          >
            <option value="">Zelfde locatie als A</option>
            <option
              v-for="loc in compareLocationOptions"
              :key="loc.id"
              :value="loc.id"
            >
              {{ loc.label }}
            </option>
          </select>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white"
              @click="applyCompare"
            >
              Toepassen
            </button>
            <button
              v-if="compareEnabled"
              type="button"
              class="rounded border border-gray-300 px-3 py-1.5 text-sm"
              @click="clearCompare"
            >
              Uit
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DailyOpsRevenuePeriodId } from '~/types/daily-ops-revenue'
import {
  REVENUE_LOCATIONS,
  REVENUE_PERIOD_GROUPS,
  revenueSpacesForLocation,
} from '~/utils/dailyOpsRevenueAnalyticsNav'

const navBarBase =
  'scrollbar-hide inline-flex w-max max-w-full min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-md border-2 border-gray-900 bg-white p-1'

/** Matches Daily Ops pill toggles (DailyOpsHomeDashboard, DailyOpsDashboardShell). */
const pillBase =
  'rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900'

const periodSelectBase =
  'w-full cursor-pointer appearance-none pr-9'

const SELECT_MIN_WIDTH: Record<string, string> = {
  week: 'min-w-[9.5rem]',
  month: 'min-w-[10rem]',
  year: 'min-w-[9.5rem]',
  rolling: 'min-w-[10.5rem]',
  quarter: 'min-w-[8.5rem]',
  season: 'min-w-[9rem]',
}

const {
  period,
  locationId,
  locationSpace,
  primaryRange,
  compareEnabled,
  comparePeriod,
  compareLocationId,
  setPeriod,
  setLocation,
  setLocationSpace,
  setCompareAb,
} = useDailyOpsRevenueAnalyticsPeriod()

const compareOpen = ref(false)
const draftComparePeriod = ref<DailyOpsRevenuePeriodId>('last-week')
const draftCompareLocation = ref<string | null>(null)

const spaceOptions = computed(() => revenueSpacesForLocation(locationId.value))

const allPeriodOptions = computed(() =>
  REVENUE_PERIOD_GROUPS.flatMap((g) => g.options),
)

const compareLocationOptions = computed(() =>
  REVENUE_LOCATIONS.filter((l): l is typeof l & { id: string } => l.id != null),
)

watch(comparePeriod, (p: DailyOpsRevenuePeriodId | null) => {
  if (p) draftComparePeriod.value = p
})
watch(compareLocationId, (l: string | null) => {
  draftCompareLocation.value = l
})

function selectMinWidthClass(groupId: string): string {
  return SELECT_MIN_WIDTH[groupId] ?? 'min-w-[9.5rem]'
}

/** Period selects + compare (on page background). */
function filterPillClass(active: boolean): string {
  return active
    ? 'bg-gray-900 text-white'
    : 'bg-white text-gray-900 hover:bg-gray-100'
}

/** Location/space pills inside bordered nav bar (DailyOpsDashboardShell). */
function navBtnClass(active: boolean): string {
  return active
    ? 'bg-gray-900 text-white'
    : 'text-gray-700 hover:bg-gray-100'
}

function periodSelectClass(groupId: string): string {
  return [pillBase, periodSelectBase, filterPillClass(groupPeriodActive(groupId))].join(' ')
}

function groupPeriodActive(groupId: string): boolean {
  const g = REVENUE_PERIOD_GROUPS.find((x) => x.id === groupId)
  return g?.options.some((o) => o.id === period.value) ?? false
}

function groupSelectValue(groupId: string): string {
  const g = REVENUE_PERIOD_GROUPS.find((x) => x.id === groupId)
  if (!g) return ''
  const hit = g.options.find((o) => o.id === period.value)
  return hit?.id ?? g.options[0]?.id ?? ''
}

function onGroupPeriodChange(groupId: string, e: Event) {
  const v = (e.target as HTMLSelectElement).value as DailyOpsRevenuePeriodId
  if (!v) return
  const g = REVENUE_PERIOD_GROUPS.find((x) => x.id === groupId)
  if (g?.options.some((o) => o.id === v)) setPeriod(v)
}

function locationLabel(id: string | null): string {
  return REVENUE_LOCATIONS.find((l) => l.id === id)?.label ?? 'Alle zaken'
}

function spaceLabel(id: string): string {
  return spaceOptions.value.find((s: { id: string; label: string }) => s.id === id)?.label ?? id
}

function toggleCompare() {
  compareOpen.value = !compareOpen.value
}

function onComparePeriodChange(e: Event) {
  draftComparePeriod.value = (e.target as HTMLSelectElement).value as DailyOpsRevenuePeriodId
}

function onCompareLocationChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  draftCompareLocation.value = v || null
}

function applyCompare() {
  setCompareAb({
    enabled: true,
    comparePeriod: draftComparePeriod.value,
    compareLocation: draftCompareLocation.value,
  })
  compareOpen.value = true
}

function clearCompare() {
  setCompareAb({ enabled: false })
  compareOpen.value = false
}
</script>
