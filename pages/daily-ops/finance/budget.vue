<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">
          P&L Budget / Forecast
        </h1>
        <p class="mt-1 max-w-2xl text-gray-500">
          Plan spend per venue so you keep ~10% profit. Seasons follow sealed history;
          months and weeks show what you can spend.
        </p>
      </div>
      <UButton
        type="button"
        variant="outline"
        color="neutral"
        icon="i-lucide-info"
        label="How this works"
        @click="openInfo"
      />
    </div>

    <UCard class="border-2 border-gray-900 bg-white! ring-0 shadow-none">
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Venue
        </p>
        <div class="inline-flex flex-wrap gap-1">
          <button
            v-for="opt in venueOptions"
            :key="opt.value"
            type="button"
            class="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors"
            :class="venue === opt.value
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900'"
            :aria-pressed="venue === opt.value"
            @click="venue = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </UCard>

    <UCard class="border-2 border-gray-900 bg-white! ring-0 shadow-none">
      <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Forecast inputs — {{ venueLabel }}
      </p>
      <p class="mt-1 text-xs text-gray-500">
        These settings apply only to the venue selected above.
      </p>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="space-y-1.5">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Revenue mode
          </p>
          <div class="inline-flex flex-wrap gap-1">
            <button
              v-for="opt in modeOptions"
              :key="opt.value"
              type="button"
              class="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors"
              :class="mode === opt.value
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900'"
              :aria-pressed="mode === opt.value"
              @click="mode = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <label
            class="text-xs font-semibold uppercase tracking-wide text-gray-500"
            for="budget-avg-rev"
          >
            Target avg €/mo
          </label>
          <UInput
            id="budget-avg-rev"
            v-model.number="targetAvg"
            type="number"
            step="1000"
            min="0"
            size="sm"
            class="max-w-40"
          />
        </div>

        <div
          v-if="mode === 'manual_pct'"
          class="space-y-1.5"
        >
          <label
            class="text-xs font-semibold uppercase tracking-wide text-gray-500"
            for="budget-rev-pct"
          >
            Season ±%
          </label>
          <UInput
            id="budget-rev-pct"
            v-model.number="revenuePct"
            type="number"
            step="1"
            size="sm"
            class="max-w-32"
          />
        </div>

        <div class="space-y-1.5">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Horizon
          </p>
          <div class="inline-flex flex-wrap gap-1">
            <button
              v-for="h in [6, 12]"
              :key="h"
              type="button"
              class="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors"
              :class="horizon === h
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900'"
              @click="horizon = h"
            >
              {{ h }}m
            </button>
          </div>
        </div>
      </div>
    </UCard>

    <DailyOpsFinancePnlBudgetForecastCard
      :venue="venue"
      :mode="mode"
      :target-avg="targetAvg"
      :revenue-pct="revenuePct"
      :horizon="horizon"
    />

    <DailyOpsFinancePnlBudgetInfoSheet
      :open="infoOpen"
      @close="closeInfo"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: dailyOpsFinanceBudget
 * @created: 2026-08-12T01:35:00.000Z
 * @last-modified: 2026-08-12T01:50:00.000Z
 * @description: Finance Budget page — per-venue inputs, season forecast, info sheet
 * @last-fix: [2026-08-12] Venue + inputs block + info sheet collapses sidebar
 * @adr-ref: ADR-019, ADR-022
 * @data-source: direct-db
 * @read-cache-json: none
 * @imports-data-from: GET /api/daily-ops/finance/analytics/budget
 */
import type { AccountingPnlAnalyticsVenue } from '~/types/accounting-pnl-analytics'
import type { PnlBudgetRevenueMode } from '~/types/accounting-pnl-budget'

const { isCollapsed } = useSidebar()
const venue = ref<AccountingPnlAnalyticsVenue>('vkb')
const mode = ref<PnlBudgetRevenueMode>('seasonal')
const targetAvg = ref(160_000)
const revenuePct = ref(0)
const horizon = ref(12)
const infoOpen = ref(false)
const sidebarBeforeInfo = ref(false)

const venueOptions: Array<{ value: AccountingPnlAnalyticsVenue; label: string }> = [
  { value: 'combined', label: 'All' },
  { value: 'vkb', label: 'VK' },
  { value: 'bea', label: 'BEA' },
  { value: 'lat', label: 'LAT' },
]

const modeOptions: Array<{ value: PnlBudgetRevenueMode; label: string }> = [
  { value: 'seasonal', label: 'Seasonal / trend' },
  { value: 'manual_pct', label: '±% season' },
]

const venueLabel = computed(() =>
  venueOptions.find((o) => o.value === venue.value)?.label ?? venue.value,
)

function openInfo (): void {
  sidebarBeforeInfo.value = isCollapsed.value
  isCollapsed.value = true
  infoOpen.value = true
}

function closeInfo (): void {
  infoOpen.value = false
  isCollapsed.value = sidebarBeforeInfo.value
}

onBeforeUnmount(() => {
  if (infoOpen.value) {
    isCollapsed.value = sidebarBeforeInfo.value
  }
})
</script>
