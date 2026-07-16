<template>
  <div
    class="overflow-hidden rounded-lg border-2 border-gray-900 bg-white"
    :class="layout !== 'month' || monthGrid ? 'max-h-[calc(100dvh-16rem)]' : ''"
  >
    <div
      class="overflow-auto overscroll-x-contain touch-pan-x"
      :class="layout !== 'month' || monthGrid ? 'max-h-[calc(100dvh-16rem)]' : 'overflow-x-auto'"
    >
      <!-- Year: venues as columns, metrics as rows -->
      <table
        v-if="layout === 'year'"
        class="min-w-full border-separate border-spacing-0 text-sm"
      >
        <thead>
          <tr class="text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
            <th
              class="sticky left-0 top-0 z-30 min-w-[9rem] border-b border-gray-200 bg-gray-50 px-4 py-3 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]"
            >
              {{ periodLabel }}
            </th>
            <th
              v-if="yearCombinedRow"
              class="sticky top-0 z-20 border-b border-l-2 border-gray-300 bg-gray-50 px-4 py-3 whitespace-nowrap"
              :class="valueCellAlignClass"
            >
              Total
            </th>
            <th
              v-for="venue in venueColumns"
              :key="venue.key"
              class="sticky top-0 z-20 border-b border-gray-200 bg-gray-50 px-4 py-3 whitespace-nowrap"
              :class="valueCellAlignClass"
            >
              {{ venue.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="metric in yearMetricRows"
            :key="metric.key"
            class="border-b border-gray-100"
            :class="metric.emphasis ? 'bg-gray-50 font-semibold' : ''"
          >
            <td
              class="sticky left-0 z-10 border-b border-gray-100 px-4 py-3 text-gray-900 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]"
              :class="[
                metric.emphasis ? 'bg-gray-50' : 'bg-white',
                metric.indent ? 'pl-8 text-gray-600 font-normal' : '',
              ]"
            >
              {{ metric.label }}
            </td>
            <td
              v-if="yearCombinedRow"
              class="border-b border-l-2 border-gray-300 px-4 py-3 tabular-nums whitespace-nowrap"
              :class="[
                valueCellAlignClass,
                metric.resultTone ? resultClass(yearCombinedRow.result) : 'text-gray-900',
                metric.emphasis ? 'bg-gray-50 font-semibold' : 'bg-white',
              ]"
            >
              {{ metric.format(yearCombinedRow) }}
            </td>
            <td
              v-for="venue in venueColumns"
              :key="`${metric.key}-${venue.key}`"
              class="border-b border-gray-100 px-4 py-3 tabular-nums whitespace-nowrap"
              :class="[
                valueCellAlignClass,
                metric.resultTone ? resultClass(venue.row.result) : 'text-gray-900',
                editing && metric.field ? 'p-1' : '',
              ]"
            >
              <input
                v-if="editing && metric.field && venue.key !== 'combined'"
                type="number"
                step="1"
                class="w-full min-w-[5.5rem] rounded border border-gray-300 bg-white px-2 py-1 text-right text-sm tabular-nums text-gray-900 focus:border-gray-900 focus:outline-none"
                :value="venue.row[metric.field]"
                @change="onYearCellChange(venue.key, metric.field, ($event.target as HTMLInputElement).value)"
              >
              <template v-else>
                {{ metric.format(venue.row) }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Month: months × venue abbreviations, metrics as rows -->
      <table
        v-else-if="monthGrid"
        class="table-fixed border-separate border-spacing-0 text-sm"
        :style="monthTableStyle"
      >
        <colgroup>
          <col :style="{ width: `${MONTH_LABEL_PX}px` }">
          <col
            v-if="combinedTotalRow"
            :style="{ width: `${monthCellPx}px` }"
          >
          <col
            v-for="venue in totalVenueColumns"
            :key="`total-col-${venue.key}`"
            :style="{ width: `${monthCellPx}px` }"
          >
          <template v-for="column in filteredMonthColumns">
            <col
              v-for="venue in column.venues"
              :key="`col-${column.month}-${venue.key}`"
              :style="{ width: `${monthCellPx}px` }"
            >
          </template>
        </colgroup>
        <thead>
          <tr class="text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
            <th
              rowspan="2"
              class="sticky left-0 top-0 z-40 border-b border-gray-200 bg-gray-50 px-4 py-3 align-bottom shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]"
              :style="{ width: `${MONTH_LABEL_PX}px`, minWidth: `${MONTH_LABEL_PX}px` }"
            >
              {{ periodLabel }}
            </th>
            <th
              v-if="totalVenueColumns.length"
              :colspan="totalVenueColumns.length + 1"
              class="sticky top-0 z-20 border-b border-l-2 border-gray-300 bg-gray-50 px-2 py-2 text-center whitespace-nowrap"
            >
              Total
            </th>
            <th
              v-for="column in filteredMonthColumns"
              :key="`month-${column.month}`"
              :colspan="column.venues.length"
              class="sticky top-0 z-20 border-b border-l-2 border-gray-300 bg-gray-50 px-2 py-2 text-center whitespace-nowrap"
              :style="{ width: `${column.venues.length * monthCellPx}px`, minWidth: `${column.venues.length * monthCellPx}px` }"
            >
              {{ column.label }}
            </th>
          </tr>
          <tr class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <th
              v-if="combinedTotalRow"
              class="sticky top-9.5 z-20 border-b border-l-2 border-gray-300 bg-gray-50 px-2 py-2 text-center whitespace-nowrap"
              :style="{ width: `${monthCellPx}px`, minWidth: `${monthCellPx}px` }"
            >
              All
            </th>
            <th
              v-for="(venue, venueIndex) in totalVenueColumns"
              :key="`total-${venue.key}`"
              class="sticky top-9.5 z-20 border-b border-gray-200 bg-gray-50 px-2 py-2 text-center whitespace-nowrap"
              :class="venueIndex === 0 ? 'border-l border-gray-200' : ''"
              :style="{ width: `${monthCellPx}px`, minWidth: `${monthCellPx}px` }"
            >
              {{ venue.shortLabel }}
            </th>
            <template v-for="column in filteredMonthColumns">
              <th
                v-for="(venue, venueIndex) in column.venues"
                :key="`${column.month}-${venue.key}`"
                class="sticky top-9.5 z-20 border-b border-gray-200 bg-gray-50 px-2 py-2 text-center whitespace-nowrap"
                :class="groupStartClass(venueIndex)"
                :style="{ width: `${monthCellPx}px`, minWidth: `${monthCellPx}px` }"
              >
                {{ venue.shortLabel }}
              </th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="metric in monthMetricRows"
            :key="metric.key"
            class="border-b border-gray-100"
            :class="metric.emphasis ? 'bg-gray-50 font-semibold' : ''"
          >
            <td
              class="sticky left-0 z-10 border-b border-gray-100 px-4 py-3 text-gray-900 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]"
              :class="[
                metric.emphasis ? 'bg-gray-50' : 'bg-white',
                metric.indent ? 'pl-8 text-gray-600 font-normal' : '',
              ]"
              :style="{ width: `${MONTH_LABEL_PX}px`, minWidth: `${MONTH_LABEL_PX}px` }"
            >
              {{ metric.label }}
            </td>
            <td
              v-if="combinedTotalRow"
              class="border-b border-l-2 border-gray-300 px-2 py-3 text-center tabular-nums text-xs whitespace-nowrap"
              :class="[
                metric.resultTone ? resultClass(combinedTotalRow.result) : 'text-gray-900',
                metric.emphasis ? 'bg-gray-50 font-semibold' : 'bg-white',
              ]"
              :style="{ width: `${monthCellPx}px`, minWidth: `${monthCellPx}px` }"
            >
              {{ metric.format(combinedTotalRow) }}
            </td>
            <td
              v-for="(venue, venueIndex) in totalVenueColumns"
              :key="`total-${venue.key}-${metric.key}`"
              class="border-b border-gray-100 px-2 py-3 text-center tabular-nums text-xs whitespace-nowrap"
              :class="[
                metric.resultTone ? resultClass(venue.row.result) : 'text-gray-900',
                venueIndex === 0 ? 'border-l border-gray-200' : '',
                metric.emphasis ? 'bg-gray-50' : 'bg-white',
              ]"
              :style="{ width: `${monthCellPx}px`, minWidth: `${monthCellPx}px` }"
            >
              {{ metric.format(venue.row) }}
            </td>
            <template v-for="column in filteredMonthColumns">
              <td
                v-for="(venue, venueIndex) in column.venues"
                :key="`${column.month}-${venue.key}-${metric.key}`"
                class="border-b border-gray-100 px-1 py-1 text-center tabular-nums text-xs whitespace-nowrap"
                :class="[
                  metric.resultTone ? resultClass(venue.row.result) : 'text-gray-900',
                  groupStartClass(venueIndex),
                  metric.emphasis ? 'bg-gray-50' : 'bg-white',
                ]"
                :style="{ width: `${monthCellPx}px`, minWidth: `${monthCellPx}px` }"
              >
                <input
                  v-if="editing && metric.field"
                  type="number"
                  step="1"
                  class="box-border w-full min-w-0 rounded border border-gray-300 bg-white px-1 py-1 text-center text-xs tabular-nums text-gray-900 focus:border-gray-900 focus:outline-none"
                  :value="venue.row[metric.field]"
                  @change="onMonthCellChange(column.month, venue.key, metric.field, ($event.target as HTMLInputElement).value)"
                >
                <template v-else>
                  {{ metric.format(venue.row) }}
                </template>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: AccountingPnlSummaryTable
 * @last-modified: 2026-07-16T11:20:00.000Z
 * @description: Accounting P&L summary table with optional live cell edit
 * @last-fix: [2026-07-16] Equal fixed month column widths (edit empty months)
 */
import type { AccountingPnlMonthGridColumn, AccountingPnlMonthGridDto } from '~/types/accounting-pnl-benchmark'
import type { AccountingPnlRow, AccountingPnlTableLine, AccountingPnlVenueId } from '~/utils/accountingPnlData'
import { accountingPnlHasMix } from '~/utils/accountingPnlMixData'
import {
  formatAccountingPnlCompact,
  formatAccountingPnlPct,
} from '~/utils/accountingPnlFormat'
import {
  accountingPnlHasFixedBreakdown,
  accountingPnlHasLaborBreakdown,
  applyAccountingPnlField,
  sumAccountingPnlRows,
  type AccountingPnlEditableField,
} from '~/utils/accountingPnlRowMath'

type PnlTableLayout = 'year' | 'month'
type PnlValueMode = 'amount' | 'percent'

type MetricRow = {
  key: string
  label: string
  indent?: boolean
  emphasis?: boolean
  resultTone?: boolean
  field?: AccountingPnlEditableField
  format: (row: AccountingPnlRow) => string
  show?: (rows: AccountingPnlRow[]) => boolean
}

const props = defineProps<{
  lines: AccountingPnlTableLine[]
  periodLabel: string
  layout?: PnlTableLayout
  monthGrid?: AccountingPnlMonthGridDto | null
  activeVenueIds?: AccountingPnlVenueId[]
  valueMode?: PnlValueMode
  editing?: boolean
}>()

const emit = defineEmits<{
  'update:lines': [AccountingPnlTableLine[]]
  'update:monthGrid': [AccountingPnlMonthGridDto]
}>()

const layout = computed(() => props.layout ?? 'month')
const editing = computed(() => Boolean(props.editing) && props.valueMode !== 'percent')
const showPercent = computed(() => props.valueMode === 'percent')
const valueCellAlignClass = computed(() => showPercent.value ? 'text-center' : 'text-right')

const MONTH_LABEL_PX = 144
const MONTH_CELL_PX = 96
const MONTH_CELL_EDIT_PX = 108

const monthCellPx = computed(() => editing.value ? MONTH_CELL_EDIT_PX : MONTH_CELL_PX)

const monthTableStyle = computed(() => {
  const monthVenueCols = filteredMonthColumns.value.reduce((n, c) => n + c.venues.length, 0)
  const totalBlock = (combinedTotalRow.value ? 1 : 0) + totalVenueColumns.value.length
  const width = MONTH_LABEL_PX + (totalBlock + monthVenueCols) * monthCellPx.value
  return { width: `${width}px`, minWidth: `${width}px` }
})

const activeVenueIdSet = computed(() =>
  new Set(props.activeVenueIds?.length ? props.activeVenueIds : ['vkb', 'bea', 'lat']),
)

const filteredMonthColumns = computed((): AccountingPnlMonthGridColumn[] => {
  if (!props.monthGrid) return []
  return props.monthGrid.columns.map((column) => ({
    ...column,
    venues: column.venues.filter((v) => activeVenueIdSet.value.has(v.key)),
  })).filter((column) => column.venues.length > 0)
})

const totalVenueColumns = computed(() => {
  const columns = filteredMonthColumns.value
  if (!columns.length) return []

  const venueOrder = columns[0]?.venues.map((v) => v.key) ?? []
  return venueOrder.map((id) => {
    const monthlyRows = columns
      .map((col) => col.venues.find((v) => v.key === id)?.row)
      .filter((row): row is AccountingPnlRow => row != null)
    const sample = columns[0]?.venues.find((v) => v.key === id)
    return {
      key: id,
      shortLabel: sample?.shortLabel ?? id.toUpperCase(),
      row: sumAccountingPnlRows(monthlyRows),
    }
  })
})

const combinedTotalRow = computed((): AccountingPnlRow | null => {
  if (!totalVenueColumns.value.length) return null
  return sumAccountingPnlRows(totalVenueColumns.value.map((v) => v.row))
})

function groupStartClass (venueIndex: number): string {
  return venueIndex === 0 ? 'border-l-2 border-gray-300' : ''
}

const venueColumns = computed(() =>
  props.lines.filter((line) => line.key !== 'combined'),
)

const yearCombinedRow = computed((): AccountingPnlRow | null => {
  const venues = venueColumns.value.map((v) => v.row)
  if (!venues.length) return props.lines.find((line) => line.key === 'combined')?.row ?? null
  return sumAccountingPnlRows(venues)
})

const monthGridRows = computed(() =>
  filteredMonthColumns.value.flatMap((column) => column.venues.map((v) => v.row)),
)

function buildMetricRows (sampleRows: AccountingPnlRow[]): MetricRow[] {
  const pct = showPercent.value
  const showChildren = editing.value
  const defs: MetricRow[] = [
    {
      key: 'revenue',
      label: 'Revenue',
      emphasis: true,
      field: 'revenue',
      format: (row) => pct ? formatAccountingPnlPct(row.revenue, row.revenue) : formatAccountingPnlCompact(row.revenue),
    },
    {
      key: 'revenue-food',
      label: 'Food',
      indent: true,
      field: 'revenueFood',
      format: (row) => pct
        ? formatAccountingPnlPct(row.revenueFood, row.revenue)
        : formatAccountingPnlCompact(row.revenueFood),
      show: (rows) => showChildren || rows.some((r) => hasMix(r)),
    },
    {
      key: 'revenue-bev',
      label: 'Beverage',
      indent: true,
      field: 'revenueBeverage',
      format: (row) => pct
        ? formatAccountingPnlPct(row.revenueBeverage, row.revenue)
        : formatAccountingPnlCompact(row.revenueBeverage),
      show: (rows) => showChildren || rows.some((r) => hasMix(r)),
    },
    {
      key: 'cogs',
      label: 'COGS',
      emphasis: true,
      field: 'cogs',
      format: (row) => pct
        ? formatAccountingPnlPct(row.cogs, row.revenue)
        : formatAccountingPnlCompact(row.cogs),
    },
    {
      key: 'cogs-food',
      label: 'COGS food',
      indent: true,
      field: 'cogsFood',
      format: (row) => {
        if (!pct) return row.cogsFood > 0 || showChildren ? formatAccountingPnlCompact(row.cogsFood) : '—'
        return row.cogsFood > 0
          ? formatAccountingPnlPct(row.cogsFood, row.revenueFood)
          : '—'
      },
      show: (rows) => showChildren || rows.some((r) => hasMix(r)),
    },
    {
      key: 'cogs-bev',
      label: 'COGS bev',
      indent: true,
      field: 'cogsBeverage',
      format: (row) => pct
        ? formatAccountingPnlPct(row.cogsBeverage, row.revenueBeverage)
        : formatAccountingPnlCompact(row.cogsBeverage),
      show: (rows) => showChildren || rows.some((r) => hasMix(r)),
    },
    {
      key: 'labor',
      label: 'Labor',
      emphasis: true,
      field: 'labor',
      format: (row) => pct
        ? formatAccountingPnlPct(row.labor, row.revenue)
        : formatAccountingPnlCompact(row.labor),
    },
    {
      key: 'labor-lonen',
      label: 'Lonen',
      indent: true,
      field: 'laborLonen',
      format: (row) => pct
        ? formatAccountingPnlPct(row.laborLonen, row.revenue)
        : formatAccountingPnlCompact(row.laborLonen),
      show: (rows) => showChildren || rows.some((r) => accountingPnlHasLaborBreakdown(r) || r.laborLonen > 0),
    },
    {
      key: 'labor-sociale',
      label: 'Sociale lasten',
      indent: true,
      field: 'laborSocialeLasten',
      format: (row) => pct
        ? formatAccountingPnlPct(row.laborSocialeLasten, row.revenue)
        : (row.laborSocialeLasten > 0 || showChildren ? formatAccountingPnlCompact(row.laborSocialeLasten) : '—'),
      show: (rows) => showChildren || rows.some((r) => accountingPnlHasLaborBreakdown(r)),
    },
    {
      key: 'labor-pensioen',
      label: 'Pensioen',
      indent: true,
      field: 'laborPensioen',
      format: (row) => pct
        ? formatAccountingPnlPct(row.laborPensioen, row.revenue)
        : (row.laborPensioen > 0 || showChildren ? formatAccountingPnlCompact(row.laborPensioen) : '—'),
      show: (rows) => showChildren || rows.some((r) => accountingPnlHasLaborBreakdown(r)),
    },
    {
      key: 'labor-overig',
      label: 'Overig',
      indent: true,
      field: 'laborOverig',
      format: (row) => pct
        ? formatAccountingPnlPct(row.laborOverig, row.revenue)
        : (row.laborOverig > 0 || showChildren ? formatAccountingPnlCompact(row.laborOverig) : '—'),
      show: (rows) => showChildren || rows.some((r) => accountingPnlHasLaborBreakdown(r)),
    },
    {
      key: 'fixed',
      label: 'Fixed',
      emphasis: true,
      field: 'fixed',
      format: (row) => pct
        ? formatAccountingPnlPct(row.fixed, row.revenue)
        : formatAccountingPnlCompact(row.fixed),
    },
    {
      key: 'fixed-overige',
      label: 'Overige',
      indent: true,
      field: 'fixedOverige',
      format: (row) => pct
        ? formatAccountingPnlPct(row.fixedOverige, row.revenue)
        : formatAccountingPnlCompact(row.fixedOverige),
      show: (rows) => showChildren || rows.some((r) => accountingPnlHasFixedBreakdown(r) || r.fixedOverige > 0),
    },
    {
      key: 'fixed-afschrijving',
      label: 'Afschrijving',
      indent: true,
      field: 'fixedAfschrijving',
      format: (row) => pct
        ? formatAccountingPnlPct(row.fixedAfschrijving, row.revenue)
        : (row.fixedAfschrijving > 0 || showChildren ? formatAccountingPnlCompact(row.fixedAfschrijving) : '—'),
      show: (rows) => showChildren || rows.some((r) => accountingPnlHasFixedBreakdown(r)),
    },
    {
      key: 'fixed-financieel',
      label: 'Financieel',
      indent: true,
      field: 'fixedFinancieel',
      format: (row) => pct
        ? formatAccountingPnlPct(row.fixedFinancieel, row.revenue)
        : (row.fixedFinancieel > 0 || showChildren ? formatAccountingPnlCompact(row.fixedFinancieel) : '—'),
      show: (rows) => showChildren || rows.some((r) => accountingPnlHasFixedBreakdown(r)),
    },
    {
      key: 'result',
      label: 'Result',
      emphasis: true,
      resultTone: true,
      format: (row) => pct ? formatResultPct(row) : formatResult(row),
    },
  ]
  return defs.filter((d) => !d.show || d.show(sampleRows))
}

const yearMetricRows = computed(() =>
  buildMetricRows(venueColumns.value.map((c) => c.row)),
)

const monthMetricRows = computed(() => buildMetricRows(monthGridRows.value))

function hasMix (row: AccountingPnlRow): boolean {
  return accountingPnlHasMix(row)
}

function formatResult (row: AccountingPnlRow): string {
  const amount = formatAccountingPnlCompact(Math.abs(row.result))
  const pct = formatAccountingPnlPct(Math.abs(row.result), row.revenue)
  const sign = row.result >= 0 ? '+' : '−'
  if (row.revenue <= 0) return `${sign}${amount.replace(/^−/, '')}`
  return `${sign}${amount.replace(/^−/, '')} (${sign}${pct.replace('—', '0')})`
}

function formatResultPct (row: AccountingPnlRow): string {
  if (row.revenue <= 0) return '—'
  const pct = Math.round((row.result / row.revenue) * 100)
  const sign = pct >= 0 ? '+' : '−'
  return `${sign}${Math.abs(pct)}%`
}

function resultClass (result: number): string {
  return result >= 0 ? 'text-emerald-700' : 'text-red-700'
}

function parseCellValue (raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function onYearCellChange (venueKey: string, field: AccountingPnlEditableField, raw: string) {
  const value = parseCellValue(raw)
  const nextLines = props.lines.map((line) => {
    if (line.key !== venueKey) return line
    return { ...line, row: applyAccountingPnlField(line.row, field, value) }
  })
  const venues = nextLines.filter((l) => l.key !== 'combined').map((l) => l.row)
  const combined = sumAccountingPnlRows(venues)
  emit('update:lines', [
    ...nextLines.filter((l) => l.key !== 'combined'),
    { key: 'combined', label: 'Combined', row: combined },
  ])
}

function onMonthCellChange (
  month: number,
  venueKey: AccountingPnlVenueId,
  field: AccountingPnlEditableField,
  raw: string,
) {
  if (!props.monthGrid) return
  const value = parseCellValue(raw)
  const columns = props.monthGrid.columns.map((column) => {
    if (column.month !== month) return column
    return {
      ...column,
      venues: column.venues.map((venue) => {
        if (venue.key !== venueKey) return venue
        return { ...venue, row: applyAccountingPnlField(venue.row, field, value) }
      }),
    }
  })
  emit('update:monthGrid', { columns })
}
</script>
