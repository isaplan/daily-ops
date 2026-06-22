<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">P&L — Accounting</h1>
      <p class="mt-1 text-gray-500">
        Real accounting P&L per venue — revenue split Food / Beverage, COGS, labor, overige bedrijfskosten.
      </p>
    </div>

    <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-end gap-4">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">View</p>
            <UiPillTabs
              v-model="viewMode"
              :options="viewModeOptions"
              aria-label="P&L view mode"
            />
          </div>

          <div
            v-if="viewMode === 'month' || (viewMode === 'year' && displayMode === 'table')"
            class="space-y-2"
          >
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Year</p>
            <USelectMenu
              v-model="selectedYear"
              :items="yearOptions"
              value-attribute="value"
              class="min-w-40"
            />
          </div>

          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Display</p>
            <UiPillTabs
              v-model="displayMode"
              :options="displayModeOptions"
              aria-label="P&L display mode"
            />
          </div>

          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Values</p>
            <UiPillTabs
              v-model="valueMode"
              :options="valueModeOptions"
              aria-label="P&L value display"
            />
          </div>
        </div>

        <div
          v-if="viewMode === 'month' || (viewMode === 'year' && displayMode === 'graph')"
          class="space-y-2 border-t border-gray-100 pt-4"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Locations</p>
          <div class="inline-flex flex-wrap gap-1">
            <button
              v-for="venue in venuePillOptions"
              :key="venue.value"
              type="button"
              class="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors"
              :class="activeVenueIds.has(venue.value)
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900'"
              :aria-pressed="activeVenueIds.has(venue.value)"
              @click="toggleVenue(venue.value)"
            >
              {{ venue.label }}
            </button>
          </div>
        </div>
      </div>
    </UCard>

    <UAlert
      v-if="fetchError"
      color="error"
      variant="soft"
      title="Could not load P&L benchmarks"
      :description="fetchError"
    />

    <div v-else-if="pending" class="rounded-lg border-2 border-gray-900 bg-white p-8">
      <USkeleton class="h-48 w-full" />
    </div>

    <DailyOpsAccountingPnlSummaryTable
      v-else-if="displayMode === 'table' && hasTableData"
      :lines="tableLines"
      :period-label="tablePeriodLabel"
      :layout="viewMode"
      :month-grid="monthGrid"
      :active-venue-ids="activeVenueIdList"
      :value-mode="valueMode"
    />

    <DailyOpsAccountingPnlStackChart
      v-else-if="displayMode === 'graph' && hasGraphData"
      :layout="viewMode"
      :period-label="graphPeriodLabel"
      :year-grid="yearGrid"
      :month-grid="monthGrid"
      :active-venue-ids="activeVenueIdList"
      :value-mode="valueMode"
    />

    <UAlert
      v-else-if="!pending"
      color="neutral"
      variant="soft"
      title="No P&L data for this period"
      description="Benchmarks are stored in accounting_pnl_benchmark. Re-seed if empty."
    />

    <UCard class="border border-gray-200 !bg-white ring-0 shadow-none">
      <p class="text-xs text-gray-600">
        <strong>Food</strong> = geproduceerde goederen · <strong>Beverage</strong> = handelsgoederen (VKB: groepen).
        <strong>COGS bev</strong> = inkoopwaarde handelsgoederen; food = uitbesteed werk where shown.
        <strong>Fixed</strong> = overige bedrijfskosten (excl. afschrijving &amp; financial).
      </p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { AccountingPnlBenchmarkResponseDto } from '~/types/accounting-pnl-benchmark'
import type { AccountingPnlVenueId } from '~/utils/accountingPnlData'
import {
  ACCOUNTING_PNL_VENUES,
  ACCOUNTING_PNL_YEARS,
  type AccountingPnlYear,
} from '~/utils/accountingPnlData'

type PnlViewMode = 'year' | 'month'
type PnlDisplayMode = 'table' | 'graph'
type PnlValueMode = 'amount' | 'percent'

const ALL_VENUE_IDS: AccountingPnlVenueId[] = ['vkb', 'bea', 'lat']

const viewMode = ref<PnlViewMode>('year')
const displayMode = ref<PnlDisplayMode>('table')
const valueMode = ref<PnlValueMode>('amount')
const selectedYear = ref<AccountingPnlYear>(2026)
const activeVenueIds = ref<Set<AccountingPnlVenueId>>(new Set(ALL_VENUE_IDS))

const venuePillOptions = ACCOUNTING_PNL_VENUES.map((v) => ({
  value: v.id,
  label: v.shortLabel,
}))

const activeVenueIdList = computed(() => ALL_VENUE_IDS.filter((id) => activeVenueIds.value.has(id)))

function toggleVenue (id: AccountingPnlVenueId) {
  const next = new Set(activeVenueIds.value)
  if (next.has(id)) {
    if (next.size <= 1) return
    next.delete(id)
  } else {
    next.add(id)
  }
  activeVenueIds.value = next
}

const viewModeOptions = [
  { value: 'year' as const, label: 'Year' },
  { value: 'month' as const, label: 'Month' },
]

const displayModeOptions = [
  { value: 'table' as const, label: 'Table' },
  { value: 'graph' as const, label: 'Graph' },
]

const valueModeOptions = [
  { value: 'amount' as const, label: '#' },
  { value: 'percent' as const, label: '%' },
]

function normalizeYear (raw: unknown): AccountingPnlYear {
  const year = Number(typeof raw === 'object' && raw && 'value' in raw
    ? (raw as { value: unknown }).value
    : raw)
  if (year === 2024 || year === 2025 || year === 2026) return year
  return 2026
}

const pnlQuery = computed(() => {
  const year = normalizeYear(selectedYear.value)
  const q: Record<string, string | number> = { year }
  if (viewMode.value === 'month' || (viewMode.value === 'year' && displayMode.value === 'graph')) {
    q.grid = viewMode.value === 'month' ? 'months' : 'years'
  }
  return q
})

const { data, pending, error: fetchErr } = useFetch<AccountingPnlBenchmarkResponseDto>(
  '/api/daily-ops/finance/pnl',
  { query: pnlQuery, watch: [pnlQuery] },
)

const fetchError = computed(() => {
  if (!fetchErr.value) return null
  return fetchErr.value.message ?? 'Unknown error'
})

const yearOptions = computed(() =>
  (data.value?.availableYears ?? [...ACCOUNTING_PNL_YEARS]).map((year) => ({
    label: year === 2026 ? '2026 (Jan–May)' : String(year),
    value: year,
  })),
)

watch(selectedYear, (raw) => {
  selectedYear.value = normalizeYear(raw)
})

const tableLines = computed(() => data.value?.lines ?? [])
const monthGrid = computed(() => data.value?.monthGrid ?? null)
const yearGrid = computed(() => data.value?.yearGrid ?? null)
const tablePeriodLabel = computed(() => data.value?.periodLabel ?? '')
const graphPeriodLabel = computed(() => {
  if (viewMode.value === 'year') return 'Revenue by venue · all years'
  return tablePeriodLabel.value
})
const hasTableData = computed(() => {
  if (viewMode.value === 'month') {
    return (monthGrid.value?.columns.length ?? 0) > 0 && activeVenueIdList.value.length > 0
  }
  return tableLines.value.length > 0
})
const hasGraphData = computed(() => {
  if (viewMode.value === 'month') {
    return (monthGrid.value?.columns.length ?? 0) > 0 && activeVenueIdList.value.length > 0
  }
  return (yearGrid.value?.columns.length ?? 0) > 0 && activeVenueIdList.value.length > 0
})
</script>
