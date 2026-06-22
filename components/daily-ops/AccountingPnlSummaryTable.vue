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
              ]"
            >
              {{ metric.format(venue.row) }}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Month: months × venue abbreviations, metrics as rows -->
      <table
        v-else-if="monthGrid"
        class="min-w-full table-fixed border-separate border-spacing-0 text-sm"
      >
        <colgroup>
          <col class="w-36">
          <col
            v-if="combinedTotalRow"
            class="w-24"
          >
          <col
            v-for="venue in totalVenueColumns"
            :key="`total-col-${venue.key}`"
            class="w-24"
          >
          <template v-for="column in filteredMonthColumns">
            <col
              v-for="venue in column.venues"
              :key="`col-${column.month}-${venue.key}`"
              class="w-24"
            >
          </template>
        </colgroup>
        <thead>
          <tr class="text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
            <th
              rowspan="2"
              class="sticky left-0 top-0 z-40 w-36 border-b border-gray-200 bg-gray-50 px-4 py-3 align-bottom shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]"
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
            >
              {{ column.label }}
            </th>
          </tr>
          <tr class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <th
              v-if="combinedTotalRow"
              class="sticky top-9.5 z-20 w-24 border-b border-l-2 border-gray-300 bg-gray-50 px-2 py-2 text-center whitespace-nowrap"
            >
              All
            </th>
            <th
              v-for="(venue, venueIndex) in totalVenueColumns"
              :key="`total-${venue.key}`"
              class="sticky top-9.5 z-20 w-24 border-b border-gray-200 bg-gray-50 px-2 py-2 text-center whitespace-nowrap"
              :class="venueIndex === 0 ? 'border-l border-gray-200' : ''"
            >
              {{ venue.shortLabel }}
            </th>
            <template v-for="column in filteredMonthColumns">
              <th
                v-for="(venue, venueIndex) in column.venues"
                :key="`${column.month}-${venue.key}`"
                class="sticky top-9.5 z-20 w-24 border-b border-gray-200 bg-gray-50 px-2 py-2 text-center whitespace-nowrap"
                :class="groupStartClass(venueIndex)"
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
              class="sticky left-0 z-10 w-36 border-b border-gray-100 px-4 py-3 text-gray-900 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]"
              :class="[
                metric.emphasis ? 'bg-gray-50' : 'bg-white',
                metric.indent ? 'pl-8 text-gray-600 font-normal' : '',
              ]"
            >
              {{ metric.label }}
            </td>
            <td
              v-if="combinedTotalRow"
              class="w-24 border-b border-l-2 border-gray-300 px-2 py-3 text-center tabular-nums text-xs whitespace-nowrap"
              :class="[
                metric.resultTone ? resultClass(combinedTotalRow.result) : 'text-gray-900',
                metric.emphasis ? 'bg-gray-50 font-semibold' : 'bg-white',
              ]"
            >
              {{ metric.format(combinedTotalRow) }}
            </td>
            <td
              v-for="(venue, venueIndex) in totalVenueColumns"
              :key="`total-${venue.key}-${metric.key}`"
              class="w-24 border-b border-gray-100 px-2 py-3 text-center tabular-nums text-xs whitespace-nowrap"
              :class="[
                metric.resultTone ? resultClass(venue.row.result) : 'text-gray-900',
                venueIndex === 0 ? 'border-l border-gray-200' : '',
                metric.emphasis ? 'bg-gray-50' : 'bg-white',
              ]"
            >
              {{ metric.format(venue.row) }}
            </td>
            <template v-for="column in filteredMonthColumns">
              <td
                v-for="(venue, venueIndex) in column.venues"
                :key="`${column.month}-${venue.key}-${metric.key}`"
                class="w-24 border-b border-gray-100 px-2 py-3 text-center tabular-nums text-xs whitespace-nowrap"
                :class="[
                  metric.resultTone ? resultClass(venue.row.result) : 'text-gray-900',
                  groupStartClass(venueIndex),
                  metric.emphasis ? 'bg-gray-50' : 'bg-white',
                ]"
              >
                {{ metric.format(venue.row) }}
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AccountingPnlMonthGridColumn, AccountingPnlMonthGridDto } from '~/types/accounting-pnl-benchmark'
import type { AccountingPnlRow, AccountingPnlTableLine, AccountingPnlVenueId } from '~/utils/accountingPnlData'
import { accountingPnlHasMix } from '~/utils/accountingPnlMixData'
import {
  formatAccountingPnlCompact,
  formatAccountingPnlPct,
} from '~/utils/accountingPnlFormat'

type PnlTableLayout = 'year' | 'month'
type PnlValueMode = 'amount' | 'percent'

type MetricRow = {
  key: string
  label: string
  indent?: boolean
  emphasis?: boolean
  resultTone?: boolean
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
}>()

const layout = computed(() => props.layout ?? 'month')
const showPercent = computed(() => props.valueMode === 'percent')
const valueCellAlignClass = computed(() => showPercent.value ? 'text-center' : 'text-right')

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

function sumPnlRows (rows: AccountingPnlRow[]): AccountingPnlRow {
  return rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      revenueFood: acc.revenueFood + row.revenueFood,
      revenueBeverage: acc.revenueBeverage + row.revenueBeverage,
      labor: acc.labor + row.labor,
      cogs: acc.cogs + row.cogs,
      cogsFood: acc.cogsFood + row.cogsFood,
      cogsBeverage: acc.cogsBeverage + row.cogsBeverage,
      fixed: acc.fixed + row.fixed,
      result: acc.result + row.result,
    }),
    {
      revenue: 0,
      revenueFood: 0,
      revenueBeverage: 0,
      labor: 0,
      cogs: 0,
      cogsFood: 0,
      cogsBeverage: 0,
      fixed: 0,
      result: 0,
    },
  )
}

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
      row: sumPnlRows(monthlyRows),
    }
  })
})

const combinedTotalRow = computed((): AccountingPnlRow | null => {
  if (!totalVenueColumns.value.length) return null
  return sumPnlRows(totalVenueColumns.value.map((v) => v.row))
})

function groupStartClass (venueIndex: number): string {
  return venueIndex === 0 ? 'border-l-2 border-gray-300' : ''
}

const venueColumns = computed(() =>
  props.lines.filter((line) => line.key !== 'combined'),
)

const yearCombinedRow = computed((): AccountingPnlRow | null =>
  props.lines.find((line) => line.key === 'combined')?.row ?? null,
)

const monthGridRows = computed(() =>
  filteredMonthColumns.value.flatMap((column) => column.venues.map((v) => v.row)),
)

function buildMetricRows (sampleRows: AccountingPnlRow[]): MetricRow[] {
  const pct = showPercent.value
  const defs: MetricRow[] = [
    {
      key: 'revenue',
      label: 'Revenue',
      emphasis: true,
      format: (row) => pct ? formatAccountingPnlPct(row.revenue, row.revenue) : formatAccountingPnlCompact(row.revenue),
    },
    {
      key: 'revenue-food',
      label: 'Food',
      indent: true,
      format: (row) => pct
        ? formatAccountingPnlPct(row.revenueFood, row.revenue)
        : formatAccountingPnlCompact(row.revenueFood),
      show: (rows) => rows.some((r) => hasMix(r)),
    },
    {
      key: 'revenue-bev',
      label: 'Beverage',
      indent: true,
      format: (row) => pct
        ? formatAccountingPnlPct(row.revenueBeverage, row.revenue)
        : formatAccountingPnlCompact(row.revenueBeverage),
      show: (rows) => rows.some((r) => hasMix(r)),
    },
    {
      key: 'cogs',
      label: 'COGS',
      emphasis: true,
      format: (row) => pct
        ? formatAccountingPnlPct(row.cogs, row.revenue)
        : formatAccountingPnlCompact(row.cogs),
    },
    {
      key: 'cogs-food',
      label: 'COGS food',
      indent: true,
      format: (row) => {
        if (!pct) return row.cogsFood > 0 ? formatAccountingPnlCompact(row.cogsFood) : '—'
        return row.cogsFood > 0
          ? formatAccountingPnlPct(row.cogsFood, row.revenueFood)
          : '—'
      },
      show: (rows) => rows.some((r) => hasMix(r)),
    },
    {
      key: 'cogs-bev',
      label: 'COGS bev',
      indent: true,
      format: (row) => pct
        ? formatAccountingPnlPct(row.cogsBeverage, row.revenueBeverage)
        : formatAccountingPnlCompact(row.cogsBeverage),
      show: (rows) => rows.some((r) => hasMix(r)),
    },
    {
      key: 'labor',
      label: 'Labor',
      format: (row) => pct
        ? formatAccountingPnlPct(row.labor, row.revenue)
        : formatAccountingPnlCompact(row.labor),
    },
    {
      key: 'fixed',
      label: 'Fixed',
      format: (row) => pct
        ? formatAccountingPnlPct(row.fixed, row.revenue)
        : formatAccountingPnlCompact(row.fixed),
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
</script>
