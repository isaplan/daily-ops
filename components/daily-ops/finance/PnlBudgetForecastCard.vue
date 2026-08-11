<template>
  <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-gray-900">
          Budget / forecast — 10% margin floor
        </h2>
        <p class="mt-1 text-xs text-gray-500">
          Next {{ horizon }} months at clean sealed cost rates. Target: result ≥ 10% of revenue every month.
        </p>
      </div>
    </div>

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
        <label class="text-xs font-semibold uppercase tracking-wide text-gray-500" for="budget-avg-rev">
          Target avg €/mo
        </label>
        <UInput
          id="budget-avg-rev"
          v-model.number="targetAvg"
          type="number"
          step="1000"
          min="0"
          size="sm"
          class="max-w-[10rem]"
        />
      </div>

      <div v-if="mode === 'manual_pct'" class="space-y-1.5">
        <label class="text-xs font-semibold uppercase tracking-wide text-gray-500" for="budget-rev-pct">
          Season ±%
        </label>
        <UInput
          id="budget-rev-pct"
          v-model.number="revenuePct"
          type="number"
          step="1"
          size="sm"
          class="max-w-[8rem]"
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

    <UAlert
      v-if="fetchError"
      class="mt-4"
      color="error"
      variant="soft"
      title="Could not load budget"
      :description="fetchError"
    />

    <div v-else-if="pending && !budget" class="mt-4 space-y-2">
      <USkeleton class="h-16 w-full rounded-lg" />
      <USkeleton class="h-48 w-full rounded-lg" />
    </div>

    <template v-else-if="budget">
      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-lg border border-gray-200 px-3 py-2">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Break-even
          </p>
          <p class="mt-0.5 text-lg font-semibold text-gray-900">
            {{ fmt(budget.baseline.break_even) }}
          </p>
          <p class="text-xs text-gray-500">
            at clean rates
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 px-3 py-2">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Rev for 10%
          </p>
          <p class="mt-0.5 text-lg font-semibold text-gray-900">
            {{ fmt(budget.baseline.revenue_for_target_margin) }}
          </p>
          <p class="text-xs text-gray-500">
            no cost cuts
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 px-3 py-2">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Months @ 10%
          </p>
          <p class="mt-0.5 text-lg font-semibold text-gray-900">
            {{ budget.totals.months_hitting_target }}/{{ budget.months.length }}
          </p>
          <p class="text-xs text-gray-500">
            at current rates
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 px-3 py-2">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Year gap to 10%
          </p>
          <p class="mt-0.5 text-lg font-semibold text-gray-900">
            {{ fmt(budget.totals.gap_to_target) }}
          </p>
          <p class="text-xs text-gray-500">
            shortfall sum
          </p>
        </div>
      </div>

      <ul class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <li
          v-for="s in budget.season_story"
          :key="s.phase"
          class="rounded-lg border border-gray-200 px-2.5 py-2"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {{ s.months }}
          </p>
          <p class="text-xs font-semibold text-gray-900">
            {{ s.label }}
          </p>
          <p class="mt-0.5 text-[11px] leading-snug text-gray-500">
            {{ s.note }}
          </p>
        </li>
      </ul>

      <p class="mt-3 text-xs text-gray-600">
        CM {{ budget.baseline.contribution_margin.toFixed(1) }}%
        · COGS {{ budget.baseline.cogs_pct.toFixed(1) }}%
        · flex {{ budget.baseline.flex_pct.toFixed(1) }}%
        · fixed {{ fmt(budget.baseline.fixed_total) }}/mo
        (FT {{ fmt(budget.baseline.fixed_labor) }} + OH {{ fmt(budget.baseline.fixed_oh) }})
      </p>

      <ul v-if="budget.notes.length" class="mt-2 space-y-1 text-xs text-gray-500">
        <li v-for="(n, i) in budget.notes" :key="i">
          {{ n }}
        </li>
      </ul>

      <div class="mt-4 overflow-x-auto">
        <table class="min-w-full text-left text-xs">
          <thead>
            <tr class="border-b border-gray-200 text-[11px] uppercase tracking-wide text-gray-500">
              <th class="py-2 pr-3 font-semibold">
                Month
              </th>
              <th class="py-2 pr-3 font-semibold">
                Season
              </th>
              <th class="py-2 pr-3 font-semibold text-right">
                Revenue
              </th>
              <th class="py-2 pr-3 font-semibold text-right">
                vs avg
              </th>
              <th class="py-2 pr-3 font-semibold text-right">
                Result @ rates
              </th>
              <th class="py-2 pr-3 font-semibold text-right">
                10% target
              </th>
              <th class="py-2 pr-3 font-semibold text-right">
                Gap
              </th>
              <th class="py-2 font-semibold">
                Lever
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in budget.months"
              :key="m.date"
              class="border-b border-gray-100"
            >
              <td class="py-2 pr-3 font-medium text-gray-900">
                {{ m.label }}
              </td>
              <td class="py-2 pr-3 text-gray-600">
                {{ m.season_label }}
              </td>
              <td class="py-2 pr-3 text-right tabular-nums text-gray-800">
                {{ fmt(m.revenue) }}
              </td>
              <td
                class="py-2 pr-3 text-right tabular-nums"
                :class="(m.vs_avg_pct ?? 0) >= 0 ? 'text-gray-700' : 'text-amber-800'"
              >
                {{ fmtVsAvg(m.vs_avg_pct) }}
              </td>
              <td
                class="py-2 pr-3 text-right tabular-nums"
                :class="(m.result_pct_at_rates ?? 0) >= 10 ? 'text-emerald-700' : 'text-gray-800'"
              >
                {{ fmt(m.result_at_rates) }}
                <span class="text-gray-400">
                  ({{ m.result_pct_at_rates?.toFixed(1) ?? '—' }}%)
                </span>
              </td>
              <td class="py-2 pr-3 text-right tabular-nums text-gray-600">
                {{ fmt(m.target_result) }}
              </td>
              <td
                class="py-2 pr-3 text-right tabular-nums"
                :class="m.hits_target ? 'text-emerald-700' : 'text-amber-800'"
              >
                {{ m.hits_target ? 'OK' : fmt(m.gap_to_target) }}
              </td>
              <td class="py-2 text-gray-600">
                <template v-if="m.hits_target">
                  —
                </template>
                <template v-else>
                  −{{ fmt(m.cut_fixed_needed) }} fixed
                  or −{{ m.cut_variable_pp_needed.toFixed(1) }}pp COGS/flex
                </template>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-gray-300 font-semibold text-gray-900">
              <td class="py-2 pr-3" colspan="2">
                Total
              </td>
              <td class="py-2 pr-3 text-right tabular-nums">
                {{ fmt(budget.totals.revenue) }}
              </td>
              <td class="py-2 pr-3">
&nbsp;
              </td>
              <td class="py-2 pr-3 text-right tabular-nums">
                {{ fmt(budget.totals.result_at_rates) }}
              </td>
              <td class="py-2 pr-3 text-right tabular-nums">
                {{ fmt(budget.totals.target_result) }}
              </td>
              <td class="py-2 pr-3 text-right tabular-nums">
                {{ fmt(budget.totals.gap_to_target) }}
              </td>
              <td class="py-2">
&nbsp;
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
/**
 * @registry-id: PnlBudgetForecastCard
 * @created: 2026-08-12T00:15:00.000Z
 * @last-modified: 2026-08-12T00:20:00.000Z
 * @description: Budget/forecast card — seasonal or ±% revenue, 10% margin levers
 * @last-fix: [2026-08-12] Season story strip + vs-avg column
 * @adr-ref: ADR-019, ADR-022
 *
 * @exports-to:
 * ✓ pages/daily-ops/finance/analytics.vue
 */
import type { AccountingPnlAnalyticsVenue } from '~/types/accounting-pnl-analytics'
import type { PnlBudgetDto, PnlBudgetRevenueMode } from '~/types/accounting-pnl-budget'
import { formatAccountingPnlCompact } from '~/utils/accountingPnlFormat'

const props = defineProps<{
  venue: AccountingPnlAnalyticsVenue
}>()

const mode = ref<PnlBudgetRevenueMode>('seasonal')
const targetAvg = ref(160_000)
const revenuePct = ref(0)
const horizon = ref(12)

const modeOptions: Array<{ value: PnlBudgetRevenueMode; label: string }> = [
  { value: 'seasonal', label: 'Seasonal / trend' },
  { value: 'manual_pct', label: '±% season' },
]

const query = computed(() => ({
  venue: props.venue,
  mode: mode.value,
  target_avg_revenue: targetAvg.value,
  revenue_pct: mode.value === 'manual_pct' ? revenuePct.value : 0,
  horizon_months: horizon.value,
}))

const { data: budget, pending, error: fetchErr } = useFetch<PnlBudgetDto>(
  '/api/daily-ops/finance/analytics/budget',
  { query, watch: [query] },
)

const fetchError = computed(() => {
  if (!fetchErr.value) return null
  return fetchErr.value.message ?? 'Unknown error'
})

function fmt (n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return formatAccountingPnlCompact(n)
}

function fmtVsAvg (pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}
</script>
