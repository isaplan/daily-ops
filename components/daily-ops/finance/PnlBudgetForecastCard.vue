<template>
  <div class="space-y-4">
    <UAlert
      v-if="fetchError"
      color="error"
      variant="soft"
      title="Could not load budget"
      :description="fetchError"
    />

    <div v-else-if="pending && !budget" class="space-y-2">
      <USkeleton class="h-20 w-full rounded-lg" />
      <USkeleton class="h-40 w-full rounded-lg" />
    </div>

    <template v-else-if="budget">
      <UCard class="border-2 border-gray-900 bg-white! ring-0 shadow-none">
        <p class="text-sm text-gray-700">
          Keep <strong>10%</strong> of sales as profit. The rest is what you may spend.
          Food &amp; drinks ≈ <strong>25%</strong>. What’s left after fixed staff &amp; overhead is
          <strong>flex</strong>.
        </p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-lg border border-gray-200 px-3 py-2">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Sales (horizon)
            </p>
            <p class="mt-0.5 text-lg font-semibold text-gray-900">
              {{ fmt(budget.totals.revenue) }}
            </p>
          </div>
          <div class="rounded-lg border border-gray-200 px-3 py-2">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Cost budget
            </p>
            <p class="mt-0.5 text-lg font-semibold text-gray-900">
              {{ fmt(budget.totals.cost_budget) }}
            </p>
            <p class="text-xs text-gray-500">
              sales − 10%
            </p>
          </div>
          <div class="rounded-lg border border-gray-200 px-3 py-2">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Food &amp; drinks
            </p>
            <p class="mt-0.5 text-lg font-semibold text-gray-900">
              {{ fmt(budget.totals.cogs_budget) }}
            </p>
            <p class="text-xs text-gray-500">
              25% target
            </p>
          </div>
          <div class="rounded-lg border border-gray-200 px-3 py-2">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Flex left
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
        </div>
      </UCard>

      <div
        v-for="season in budget.seasons"
        :key="season.phase"
        class="overflow-hidden rounded-xl border-2 border-gray-900 bg-white"
      >
        <button
          type="button"
          class="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
          @click="toggleSeason(season.phase)"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-sm font-semibold text-gray-900">
                {{ season.label }}
              </p>
              <span class="text-xs text-gray-500">
                {{ season.months_label }}
              </span>
              <span
                v-if="season.vs_year_avg_pct != null"
                class="rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                :class="season.vs_year_avg_pct >= 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'"
              >
                {{ fmtPct(season.vs_year_avg_pct) }} vs year avg
              </span>
            </div>
            <p class="mt-1 text-xs leading-snug text-gray-600">
              {{ season.plain_summary }}
            </p>
          </div>
          <UIcon
            name="i-lucide-chevron-down"
            class="mt-0.5 size-4 shrink-0 text-gray-500 transition-transform"
            :class="openSeasons.has(season.phase) && 'rotate-180'"
          />
        </button>

        <div
          v-if="openSeasons.has(season.phase)"
          class="space-y-3 border-t border-gray-200 px-4 py-3"
        >
          <div
            v-for="m in season.months"
            :key="m.date"
            class="rounded-lg border border-gray-200"
          >
            <button
              type="button"
              class="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
              @click="toggleMonth(m.date)"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-medium text-gray-900">
                    {{ m.label }}
                  </p>
                  <span
                    v-if="m.vs_avg_pct != null"
                    class="text-[11px] tabular-nums text-gray-500"
                  >
                    {{ fmtPct(m.vs_avg_pct) }} vs year
                  </span>
                  <span
                    v-if="m.vs_season_pct != null"
                    class="text-[11px] tabular-nums text-gray-500"
                  >
                    · {{ fmtPct(m.vs_season_pct) }} vs season
                  </span>
                </div>
                <p class="mt-1 text-xs leading-snug text-gray-600">
                  {{ m.plain_summary }}
                </p>
                <div class="mt-2 flex flex-wrap gap-3 text-xs tabular-nums text-gray-700">
                  <span>Sales {{ fmt(m.revenue) }}</span>
                  <span>Spend ≤ {{ fmt(m.envelope.cost_budget) }}</span>
                  <span>Food {{ fmt(m.envelope.cogs_budget) }}</span>
                  <span
                    :class="m.envelope.flex_budget >= 0 ? 'text-emerald-700' : 'text-amber-800'"
                  >
                    Flex {{ fmt(m.envelope.flex_budget) }}
                  </span>
                </div>
              </div>
              <UIcon
                name="i-lucide-chevron-down"
                class="mt-0.5 size-4 shrink-0 text-gray-400 transition-transform"
                :class="openMonths.has(m.date) && 'rotate-180'"
              />
            </button>

            <div
              v-if="openMonths.has(m.date)"
              class="border-t border-gray-100 px-3 py-2"
            >
              <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Upcoming weeks (month ÷ {{ weeksPerMonth }})
              </p>
              <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div
                  v-for="w in weekSlots(m)"
                  :key="w.label"
                  class="rounded-md border border-gray-200 px-2.5 py-2"
                >
                  <p class="text-[11px] font-semibold text-gray-500">
                    {{ w.label }}
                  </p>
                  <p class="mt-1 text-xs text-gray-800">
                    Sales {{ fmt(w.revenue) }}
                  </p>
                  <p class="text-xs text-gray-600">
                    Spend ≤ {{ fmt(w.cost_budget) }}
                  </p>
                  <p class="text-xs text-gray-600">
                    Food {{ fmt(w.cogs_budget) }}
                  </p>
                  <p
                    class="text-xs font-medium"
                    :class="w.flex_budget >= 0 ? 'text-emerald-700' : 'text-amber-800'"
                  >
                    Flex {{ fmt(w.flex_budget) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: PnlBudgetForecastCard
 * @created: 2026-08-12T00:15:00.000Z
 * @last-modified: 2026-08-12T01:50:00.000Z
 * @description: Season → month → week forecast with plain-language cost envelopes
 * @last-fix: [2026-08-12] Season accordion + week slots; inputs moved to page
 * @adr-ref: ADR-019, ADR-022
 *
 * @exports-to:
 * ✓ pages/daily-ops/finance/budget.vue
 */
import type { AccountingPnlAnalyticsVenue } from '~/types/accounting-pnl-analytics'
import type {
  PnlBudgetDto,
  PnlBudgetMonth,
  PnlBudgetRevenueMode,
  PnlBudgetSeasonPhase,
} from '~/types/accounting-pnl-budget'
import { PNL_BUDGET_WEEKS_PER_MONTH } from '~/types/accounting-pnl-budget'
import { formatAccountingPnlCompact } from '~/utils/accountingPnlFormat'

const props = defineProps<{
  venue: AccountingPnlAnalyticsVenue
  mode: PnlBudgetRevenueMode
  targetAvg: number
  revenuePct: number
  horizon: number
}>()

const weeksPerMonth = PNL_BUDGET_WEEKS_PER_MONTH
const openSeasons = ref<Set<PnlBudgetSeasonPhase>>(new Set())
const openMonths = ref<Set<string>>(new Set())

const query = computed(() => ({
  venue: props.venue,
  mode: props.mode,
  target_avg_revenue: props.targetAvg,
  revenue_pct: props.mode === 'manual_pct' ? props.revenuePct : 0,
  horizon_months: props.horizon,
}))

const { data: budget, pending, error: fetchErr } = useFetch<PnlBudgetDto>(
  '/api/daily-ops/finance/analytics/budget',
  { query, watch: [query] },
)

watch(budget, (b) => {
  if (!b?.seasons?.length) return
  if (openSeasons.value.size) return
  openSeasons.value = new Set([b.seasons[0]!.phase])
}, { immediate: true })

const fetchError = computed(() => {
  if (!fetchErr.value) return null
  return fetchErr.value.message ?? 'Unknown error'
})

function toggleSeason (phase: PnlBudgetSeasonPhase): void {
  const next = new Set(openSeasons.value)
  if (next.has(phase)) next.delete(phase)
  else next.add(phase)
  openSeasons.value = next
}

function toggleMonth (date: string): void {
  const next = new Set(openMonths.value)
  if (next.has(date)) next.delete(date)
  else next.add(date)
  openMonths.value = next
}

function weekSlots (m: PnlBudgetMonth) {
  return Array.from({ length: weeksPerMonth }, (_, i) => ({
    label: `Week ${i + 1}`,
    revenue: m.week.revenue,
    cost_budget: m.week.cost_budget,
    cogs_budget: m.week.cogs_budget,
    flex_budget: m.week.flex_budget,
  }))
}

function fmt (n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return formatAccountingPnlCompact(n)
}

function fmtPct (n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(0)}%`
}
</script>
