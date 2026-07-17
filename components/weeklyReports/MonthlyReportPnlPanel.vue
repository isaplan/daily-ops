<template>
  <div v-if="lines.length" class="space-y-2">
    <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Accounting P&amp;L</h3>
    <DailyOpsAccountingPnlSummaryTable
      :lines="lines"
      :period-label="periodLabel"
      layout="year"
      value-mode="amount"
      :editing="false"
      :show-combined-total="false"
    />
  </div>
  <p v-else class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
    No accounting P&amp;L for this month yet.
  </p>
</template>

<script setup lang="ts">
import type { AccountingPnlBenchmarkTableLineDto } from '~/types/accounting-pnl-benchmark'
import type { AccountingPnlTableLine } from '~/utils/accountingPnlData'

const props = defineProps<{
  accountingPnl: AccountingPnlBenchmarkTableLineDto | null
  periodLabel: string
}>()

const lines = computed((): AccountingPnlTableLine[] =>
  props.accountingPnl
    ? [{ key: props.accountingPnl.key, label: props.accountingPnl.label, row: props.accountingPnl.row }]
    : [],
)
</script>
