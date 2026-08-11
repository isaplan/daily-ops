<template>
  <UCard class="border-2 border-gray-900 bg-white! ring-0 shadow-none">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-gray-900">
          Budget / forecast — cost envelope
        </h2>
        <p class="mt-1 text-xs text-gray-500">
          Cost budget = revenue − 10% result. COGS target 25% (margin 4). Rest = labor + OH; leftover = flex.
          Week = month ÷ {{ weeksPerMonth }}.
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
          class="max-w-40"
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
      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div class="rounded-lg border border-gray-200 px-3 py-2">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Cost budget (yr)
          </p>
          <p class="mt-0.5 text-lg font-semibold text-gray-900">
            {{ fmt(budget.totals.cost_budget) }}
          </p>
          <p class="text-xs text-gray-500">
            = rev − 10%
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 px-3 py-2">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            COGS @ 25%
          </p>
          <p class="mt-0.5 text-lg font-semibold text-gray-900">
            {{ fmt(budget.totals.cogs_budget) }}
          </p>
          <p class="text-xs text-gray-500">
            actual {{ budget.baseline.cogs_pct.toFixed(0) }}% sealed
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 px-3 py-2">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Labor + OH pot
          </p>
          <p class="mt-0.5 text-lg font-semibold text-gray-900">
            {{ fmt(budget.totals.labor_oh_budget) }}
          </p>
          <p class="text-xs text-gray-500">
            after COGS target
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 px-3 py-2">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Flex leftover (yr)
          </p>
          <p
            class="mt-0.5 text-lg font-semibold"
            :class="budget.totals.flex_budget >= 0 ? 'text-emerald-700' : 'text-amber-800'"
          >
            {{ fmt(budget.totals.flex_budget) }}
          </p>
          <p class="text-xs text-gray-500">
            {{ budget.totals.months_flex_ok }}/{{ budget.months.length }} months OK
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 px-3 py-2">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Fixed (sealed)
          </p>
          <p class="mt-0.5 text-lg font-semibold text-gray-900">
            {{ fmt(budget.baseline.fixed_total) }}
            <span class="text-sm font-normal text-gray-500">/mo</span>
          </p>
          <p class="text-xs text-gray-500">
            FT {{ fmt(budget.baseline.fixed_labor) }} + OH {{ fmt(budget.baseline.fixed_oh) }}
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
        BE {{ fmt(budget.baseline.break_even) }}/mo
        · need {{ fmt(budget.baseline.revenue_for_target_margin) }} for 10% at current rates
        · CM {{ budget.baseline.contribution_margin.toFixed(1) }}%
      </p>

      <ul v-if="budget.notes.length" class="mt-2 space-y-1 text-xs text-gray-500">
        <li v-for="(n, i) in budget.notes" :key="i">
          {{ n }}
        </li>
      </ul>

      <div class="mt-4 flex flex-wrap gap-1">
        <button
          type="button"
          class="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors"
          :class="periodView === 'month'
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-300 bg-white text-gray-600 hover:border-gray-900'"
          @click="periodView = 'month'"
        >
          Month
        </button>
        <button
          type="button"
          class="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors"
          :class="periodView === 'week'
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-300 bg-white text-gray-600 hover:border-gray-900'"
          @click="periodView = 'week'"
        >
          Week (÷{{ weeksPerMonth }})
        </button>
      </div>

      <div class="mt-3 overflow-x-auto">
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
                10% result
              </th>
              <th class="py-2 pr-3 font-semibold text-right">
                Cost budget
              </th>
              <th class="py-2 pr-3 font-semibold text-right">
                COGS 25%
              </th>
              <th class="py-2 pr-3 font-semibold text-right">
                Labor+OH
              </th>
              <th class="py-2 pr-3 font-semibold text-right">
                Fixed L+OH
              </th>
              <th class="py-2 pr-3 font-semibold text-right">
                Flex left
              </th>
              <th class="py-2 font-semibold">
                Note
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
                {{ fmt(periodView === 'week' ? m.week.revenue : m.revenue) }}
              </td>
              <td class="py-2 pr-3 text-right tabular-nums text-gray-600">
                {{ fmt(periodView === 'week' ? m.week.target_result : m.target_result) }}
              </td>
              <td class="py-2 pr-3 text-right tabular-nums font-medium text-gray-900">
                {{ fmt(periodView === 'week' ? m.week.cost_budget : m.envelope.cost_budget) }}
              </td>
              <td class="py-2 pr-3 text-right tabular-nums text-gray-800">
                {{ fmt(periodView === 'week' ? m.week.cogs_budget : m.envelope.cogs_budget) }}
                <span
                  v-if="periodView === 'month' && m.cogs_gap_vs_target > 50"
                  class="block text-[10px] text-amber-800"
                >
                  actual +{{ fmt(m.cogs_gap_vs_target) }}
                </span>
              </td>
              <td class="py-2 pr-3 text-right tabular-nums text-gray-800">
                {{ fmt(periodView === 'week' ? m.week.labor_oh_budget : m.envelope.labor_oh_budget) }}
              </td>
              <td class="py-2 pr-3 text-right tabular-nums text-gray-600">
                {{ fmt(periodView === 'week'
                  ? m.week.fixed_labor + m.week.fixed_oh
                  : m.envelope.fixed_labor + m.envelope.fixed_oh) }}
              </td>
              <td
                class="py-2 pr-3 text-right tabular-nums font-medium"
                :class="(periodView === 'week' ? m.week.flex_budget : m.envelope.flex_budget) >= 0
                  ? 'text-emerald-700'
                  : 'text-amber-800'"
              >
                {{ fmt(periodView === 'week' ? m.week.flex_budget : m.envelope.flex_budget) }}
              </td>
              <td class="py-2 text-gray-600">
                <template v-if="m.envelope.flex_budget_ok && m.cogs_gap_vs_target <= 50">
                  —
                </template>
                <template v-else-if="!m.envelope.flex_budget_ok">
                  Cut fixed or COGS — no flex room
                </template>
                <template v-else>
                  COGS above 25% target
                </template>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-gray-300 font-semibold text-gray-900">
              <td class="py-2 pr-3" colspan="2">
                Total {{ periodView === 'week' ? '(weeks sum)' : '' }}
              </td>
              <td class="py-2 pr-3 text-right tabular-nums">
                {{ fmt(periodView === 'week' ? budget.totals.revenue / weeksPerMonth : budget.totals.revenue) }}
              </td>
              <td class="py-2 pr-3 text-right tabular-nums">
                {{ fmt(periodView === 'week' ? budget.totals.target_result / weeksPerMonth : budget.totals.target_result) }}
              </td>
              <td class="py-2 pr-3 text-right tabular-nums">
                {{ fmt(periodView === 'week' ? budget.totals.cost_budget / weeksPerMonth : budget.totals.cost_budget) }}
              </td>
              <td class="py-2 pr-3 text-right tabular-nums">
                {{ fmt(periodView === 'week' ? budget.totals.cogs_budget / weeksPerMonth : budget.totals.cogs_budget) }}
              </td>
              <td class="py-2 pr-3 text-right tabular-nums">
                {{ fmt(periodView === 'week' ? budget.totals.labor_oh_budget / weeksPerMonth : budget.totals.labor_oh_budget) }}
              </td>
              <td class="py-2 pr-3">
&nbsp;
              </td>
              <td class="py-2 pr-3 text-right tabular-nums">
                {{ fmt(periodView === 'week' ? budget.totals.flex_budget / weeksPerMonth : budget.totals.flex_budget) }}
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
 * @last-modified: 2026-08-12T00:40:00.000Z
 * @description: Budget/forecast — cost=rev−10%, COGS@25%, fixed vs flex, month/week toggle
 * @last-fix: [2026-08-12] Phase 1 cost envelope + weekly ÷4 view for team planning
 * @adr-ref: ADR-019, ADR-022
 *
 * @exports-to:
 * ✓ pages/daily-ops/finance/analytics.vue
 */
import type { AccountingPnlAnalyticsVenue } from '~/types/accounting-pnl-analytics'
import type { PnlBudgetDto, PnlBudgetRevenueMode } from '~/types/accounting-pnl-budget'
import { PNL_BUDGET_WEEKS_PER_MONTH } from '~/types/accounting-pnl-budget'
import { formatAccountingPnlCompact } from '~/utils/accountingPnlFormat'

const props = defineProps<{
  venue: AccountingPnlAnalyticsVenue
}>()

const mode = ref<PnlBudgetRevenueMode>('seasonal')
const targetAvg = ref(160_000)
const revenuePct = ref(0)
const horizon = ref(12)
const periodView = ref<'month' | 'week'>('month')
const weeksPerMonth = PNL_BUDGET_WEEKS_PER_MONTH

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
</script>
