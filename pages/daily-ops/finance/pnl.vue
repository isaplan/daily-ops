<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">P&L — Accounting</h1>
        <p class="mt-1 text-gray-500">
          Real accounting P&L per venue — revenue, COGS, labor, and fixed cost breakdowns.
        </p>
      </div>
      <div
        v-if="!editing"
        class="flex flex-wrap items-center gap-2"
      >
        <UButton
          color="neutral"
          variant="outline"
          :disabled="pending || startingEdit || recalculating"
          :loading="recalculating"
          @click="recalculateAssumptions"
        >
          Recalculate P&L + break-even
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          :disabled="pending || startingEdit"
          :loading="startingEdit"
          @click="startEditing"
        >
          Edit
        </UButton>
      </div>
    </div>

    <div
      v-if="editing"
      class="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-gray-900 bg-white px-4 py-3 shadow-sm"
    >
      <p class="text-sm text-gray-700">
        Editing monthly P&L — empty months included so you can add new ones.
      </p>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:border-gray-900 hover:text-gray-900 disabled:opacity-50"
          :disabled="saving"
          @click="cancelEditing"
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-md border-2 border-gray-900 bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          :disabled="saving"
          @click="saveEdits"
        >
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>

    <UAlert
      v-if="saveError"
      color="error"
      variant="soft"
      title="Could not save P&L"
      :description="saveError"
    />
    <UAlert
      v-if="saveOk"
      color="success"
      variant="soft"
      title="P&L saved"
      :description="saveOk"
    />

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
              :disabled="editing"
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
              :disabled="editing"
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
      :lines="draftLines"
      :period-label="tablePeriodLabel"
      :layout="viewMode"
      :month-grid="draftMonthGrid"
      :active-venue-ids="activeVenueIdList"
      :value-mode="valueMode"
      :editing="editing"
      @update:lines="onLinesUpdate"
      @update:month-grid="onMonthGridUpdate"
    />

    <DailyOpsChartExpandShell
      v-else-if="displayMode === 'graph' && hasGraphData"
      :title="`P&L ${viewMode === 'year' ? 'by Venue' : 'by Month'}`"
      :subtitle="graphPeriodLabel"
    >
      <template #default="{ width, height }">
        <DailyOpsAccountingPnlStackChart
          :layout="viewMode"
          :period-label="graphPeriodLabel"
          :year-grid="yearGrid"
          :month-grid="monthGrid"
          :active-venue-ids="activeVenueIdList"
          :value-mode="valueMode"
          :width="width"
          :height="height"
        />
      </template>
    </DailyOpsChartExpandShell>

    <UAlert
      v-else-if="!pending"
      color="neutral"
      variant="soft"
      title="No P&L data for this period"
      description="Benchmarks are stored in accounting_pnl_benchmark. Re-seed if empty."
    />

    <UCard class="border border-gray-200 !bg-white ring-0 shadow-none">
      <p class="text-xs text-gray-600">
        Food = geproduceerde goederen. Beverage = handelsgoederen.
        Edit mode shows Analyse grandchildren (omzet, inkopen, salarissen + inhuur under Lonen).
        Labor = Lonen + Sociale lasten + Pensioen + Overig.
        Fixed = Overige + Afschrijving + Financieel.
      </p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: dailyOpsFinancePnl
 * @last-modified: 2026-07-24T11:40:00.000Z
 * @description: Accounting P&L benchmarks with manual edit/save
 * @last-fix: [2026-07-24] Recalculate P&L % + break-even; save refreshes assumptions
 * @adr-ref: ADR-013, ADR-014
 * @data-source: direct-db
 * @read-cache-json: none
 * @imports-data-from: GET|PUT /api/daily-ops/finance/pnl · POST …/pnl/recalculate
 */
import type {
  AccountingPnlBenchmarkResponseDto,
  AccountingPnlBenchmarkTableLineDto,
  AccountingPnlBenchmarkUpsertResponse,
  AccountingPnlMonthGridDto,
} from '~/types/accounting-pnl-benchmark'
import type { AccountingPnlVenueId } from '~/utils/accountingPnlData'
import {
  ACCOUNTING_PNL_MONTH_LONG_LABELS,
  ACCOUNTING_PNL_VENUES,
  ACCOUNTING_PNL_YEARS,
  type AccountingPnlYear,
} from '~/utils/accountingPnlData'
import { normalizeAccountingPnlRow } from '~/utils/accountingPnlRowMath'

type PnlViewMode = 'year' | 'month'
type PnlDisplayMode = 'table' | 'graph'
type PnlValueMode = 'amount' | 'percent'

const ALL_VENUE_IDS: AccountingPnlVenueId[] = ['vkb', 'bea', 'lat']

const viewMode = ref<PnlViewMode>('year')
const displayMode = ref<PnlDisplayMode>('table')
const valueMode = ref<PnlValueMode>('amount')
const selectedYear = ref<AccountingPnlYear>(2026)
const activeVenueIds = ref<Set<AccountingPnlVenueId>>(new Set(ALL_VENUE_IDS))

const editing = ref(false)
const startingEdit = ref(false)
const saving = ref(false)
const recalculating = ref(false)
const saveError = ref<string | null>(null)
const saveOk = ref<string | null>(null)
const draftLines = ref<AccountingPnlBenchmarkTableLineDto[]>([])
const draftMonthGrid = ref<AccountingPnlMonthGridDto | null>(null)
/** Months that already existed when edit started (always saved even if still zero). */
const originalMonthKeys = ref<Set<number>>(new Set())

const venuePillOptions = ACCOUNTING_PNL_VENUES.map((v) => ({
  value: v.id,
  label: v.shortLabel,
}))

const activeVenueIdList = computed(() => ALL_VENUE_IDS.filter((id) => activeVenueIds.value.has(id)))

function toggleVenue (id: AccountingPnlVenueId) {
  if (editing.value) return
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

const { data, pending, error: fetchErr, refresh } = useFetch<AccountingPnlBenchmarkResponseDto>(
  '/api/daily-ops/finance/pnl',
  { query: pnlQuery, watch: [pnlQuery] },
)

const fetchError = computed(() => {
  if (!fetchErr.value) return null
  return fetchErr.value.message ?? 'Unknown error'
})

const yearOptions = computed(() =>
  (data.value?.availableYears ?? [...ACCOUNTING_PNL_YEARS]).map((year) => ({
    label: String(year),
    value: year,
  })),
)

watch(selectedYear, (raw) => {
  selectedYear.value = normalizeYear(raw)
})

watch([viewMode, displayMode, valueMode], () => {
  if (!editing.value) return
  viewMode.value = 'month'
  displayMode.value = 'table'
  valueMode.value = 'amount'
})

watch(
  () => data.value,
  (next) => {
    if (editing.value) return
    draftLines.value = next?.lines ? structuredClone(next.lines) : []
    draftMonthGrid.value = next?.monthGrid ? structuredClone(next.monthGrid) : null
  },
  { immediate: true },
)

function emptyVenueCells () {
  return ACCOUNTING_PNL_VENUES.map((venue) => ({
    key: venue.id,
    shortLabel: venue.shortLabel,
    row: normalizeAccountingPnlRow({}),
  }))
}

/** Pad to Jan–Dec so missing months (e.g. July) are editable. */
function padMonthGridForEdit (grid: AccountingPnlMonthGridDto | null): AccountingPnlMonthGridDto {
  const byMonth = new Map((grid?.columns ?? []).map((column) => [column.month, column]))
  return {
    columns: Array.from({ length: 12 }, (_, index) => {
      const month = index + 1
      const existing = byMonth.get(month)
      if (existing) {
        const present = new Set(existing.venues.map((v) => v.key))
        const venues = [
          ...existing.venues,
          ...emptyVenueCells().filter((v) => !present.has(v.key)),
        ]
        return { ...existing, venues }
      }
      return {
        month,
        label: ACCOUNTING_PNL_MONTH_LONG_LABELS[month - 1] ?? String(month),
        venues: emptyVenueCells(),
      }
    }),
  }
}

function monthColumnHasData (venues: AccountingPnlMonthGridDto['columns'][0]['venues']): boolean {
  return venues.some((venue) => {
    const row = venue.row
    return Math.abs(row.revenue)
      + Math.abs(row.cogs)
      + Math.abs(row.labor)
      + Math.abs(row.fixed)
      + Math.abs(row.result) > 0
  })
}

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
    return (draftMonthGrid.value?.columns.length ?? monthGrid.value?.columns.length ?? 0) > 0
      && activeVenueIdList.value.length > 0
  }
  return (draftLines.value.length || tableLines.value.length) > 0
})
const hasGraphData = computed(() => {
  if (viewMode.value === 'month') {
    return (monthGrid.value?.columns.length ?? 0) > 0 && activeVenueIdList.value.length > 0
  }
  return (yearGrid.value?.columns.length ?? 0) > 0 && activeVenueIdList.value.length > 0
})

async function startEditing () {
  if (startingEdit.value || saving.value) return
  startingEdit.value = true
  saveError.value = null
  saveOk.value = null
  try {
    viewMode.value = 'month'
    displayMode.value = 'table'
    valueMode.value = 'amount'
    activeVenueIds.value = new Set(ALL_VENUE_IDS)
    await nextTick()
    await refresh()
    const loaded = data.value?.monthGrid ? structuredClone(data.value.monthGrid) : null
    originalMonthKeys.value = new Set((loaded?.columns ?? []).map((c) => c.month))
    draftMonthGrid.value = padMonthGridForEdit(loaded)
    draftLines.value = []
    editing.value = true
  } catch (err: unknown) {
    saveError.value = err instanceof Error ? err.message : 'Could not start edit'
  } finally {
    startingEdit.value = false
  }
}

function cancelEditing () {
  editing.value = false
  originalMonthKeys.value = new Set()
  draftLines.value = structuredClone(data.value?.lines ?? [])
  draftMonthGrid.value = data.value?.monthGrid ? structuredClone(data.value.monthGrid) : null
  saveError.value = null
}

function onLinesUpdate (lines: AccountingPnlBenchmarkTableLineDto[]) {
  draftLines.value = lines
}

function onMonthGridUpdate (grid: AccountingPnlMonthGridDto) {
  draftMonthGrid.value = grid
}

async function saveEdits () {
  saving.value = true
  saveError.value = null
  saveOk.value = null
  try {
    const year = normalizeYear(selectedYear.value)
    const columns = draftMonthGrid.value?.columns ?? []
    const periods = columns
      .filter((column) =>
        originalMonthKeys.value.has(column.month) || monthColumnHasData(column.venues),
      )
      .map((column) => {
        const venues = {} as Record<AccountingPnlVenueId, (typeof column.venues)[0]['row']>
        for (const id of ALL_VENUE_IDS) {
          const cell = column.venues.find((v) => v.key === id)
          if (!cell) throw new Error(`Missing venue ${id} in month ${column.month}`)
          venues[id] = cell.row
        }
        return { year, month: column.month, venues }
      })

    if (!periods.length) {
      throw new Error('Nothing to save — enter values in at least one month')
    }

    const result = await $fetch<AccountingPnlBenchmarkUpsertResponse>('/api/daily-ops/finance/pnl', {
      method: 'PUT',
      body: {
        periods,
        refreshAssumptions: true,
      },
    })

    editing.value = false
    originalMonthKeys.value = new Set()
    await refresh()
    draftMonthGrid.value = data.value?.monthGrid ? structuredClone(data.value.monthGrid) : null
    const beNote = result.breakEvenUpdated
      ? ` Assumptions + break-even refreshed (${result.monthsUsed ?? 0} months).`
      : ''
    saveOk.value = `Updated ${result.touched} month(s).${beNote}`
  } catch (err: unknown) {
    saveError.value = err instanceof Error ? err.message : 'Save failed'
  } finally {
    saving.value = false
  }
}

async function recalculateAssumptions () {
  recalculating.value = true
  saveError.value = null
  saveOk.value = null
  try {
    const result = await $fetch<{
      ok: boolean
      assumptionsUpdated: boolean
      breakEvenUpdated: boolean
      monthsUsed: number
    }>('/api/daily-ops/finance/pnl/recalculate', { method: 'POST' })
    saveOk.value = result.breakEvenUpdated || result.assumptionsUpdated
      ? `Recalculated from ${result.monthsUsed} sealed month(s) — P&L % and break-even updated.`
      : 'No sealed monthly P&L found to recalculate from.'
  } catch (err: unknown) {
    saveError.value = err instanceof Error ? err.message : 'Recalculate failed'
  } finally {
    recalculating.value = false
  }
}
</script>
