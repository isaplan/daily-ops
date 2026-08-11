<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">
          P&L Analytics
        </h1>
        <p class="mt-1 text-gray-500">
          Story + full sealed-month history from accounting P&L — separate from the editable source grid.
        </p>
      </div>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-file-down"
        :disabled="!data || pending"
        @click="printPdf"
      >
        Print PDF
      </UButton>
    </div>

    <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
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

    <UAlert
      v-if="fetchError"
      color="error"
      variant="soft"
      title="Could not load P&L analytics"
      :description="fetchError"
    />

    <div v-else-if="pending && !data" class="space-y-4">
      <USkeleton class="h-28 w-full rounded-lg" />
      <USkeleton class="h-80 w-full rounded-lg" />
    </div>

    <template v-else-if="data">
      <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
        <p class="text-lg font-semibold leading-snug text-gray-900">
          {{ data.verdict.headline }}
        </p>
        <ul v-if="data.verdict.bullets.length" class="mt-3 space-y-2 text-sm text-gray-700">
          <li v-for="(line, i) in data.verdict.bullets" :key="i">
            {{ line }}
          </li>
        </ul>
        <p class="mt-3 text-xs text-gray-500">
          {{ data.range_label }} · {{ data.month_count }} sealed months
        </p>
      </UCard>

      <DailyOpsFinancePnlBudgetForecastCard :venue="venue" />

      <UCard
        v-if="data.seasonal.length"
        class="border border-gray-200 !bg-white ring-0 shadow-none"
      >
        <h2 class="text-sm font-semibold text-gray-900">
          Seasonal — same month vs prior year
        </h2>
        <ul class="mt-3 space-y-2 text-sm text-gray-700">
          <li v-for="(s, i) in data.seasonal" :key="`${s.current_year}-${s.month}-${i}`">
            {{ s.note }}
          </li>
        </ul>
      </UCard>

      <DailyOpsFinancePnlAnalyticsTrendChart
        ref="chartRef"
        :series="data.series"
        :venue="venue"
        :title="`Full P&L history · ${data.range_label}`"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * @registry-id: dailyOpsFinanceAnalytics
 * @created: 2026-08-11T12:55:00.000Z
 * @last-modified: 2026-08-12T00:40:00.000Z
 * @description: Finance Analytics — sealed P&L narrative + cost-envelope budget + chart + PDF
 * @last-fix: [2026-08-12] Budget card Phase 1 (cost=rev−10%, COGS 25%, week toggle)
 * @adr-ref: ADR-022
 * @data-source: direct-db
 * @read-cache-json: none
 * @imports-data-from: GET /api/daily-ops/finance/analytics
 */
import type {
  AccountingPnlAnalyticsDto,
  AccountingPnlAnalyticsVenue,
} from '~/types/accounting-pnl-analytics'
import { buildPnlAnalyticsPdfDocumentForPrint } from '~/lib/pdf/pnlAnalyticsPdfDocument'

const venue = ref<AccountingPnlAnalyticsVenue>('combined')

const venueOptions: Array<{ value: AccountingPnlAnalyticsVenue; label: string }> = [
  { value: 'combined', label: 'All' },
  { value: 'vkb', label: 'VK' },
  { value: 'bea', label: 'BEA' },
  { value: 'lat', label: 'LAT' },
]

const query = computed(() => ({ venue: venue.value }))

const { data, pending, error: fetchErr } = useFetch<AccountingPnlAnalyticsDto>(
  '/api/daily-ops/finance/analytics',
  { query, watch: [query] },
)

const fetchError = computed(() => {
  if (!fetchErr.value) return null
  return fetchErr.value.message ?? 'Unknown error'
})

const chartRef = ref<{ captureChartSvgHtml: () => string | null } | null>(null)

function printPdf () {
  if (!data.value) return
  try {
    const svg = chartRef.value?.captureChartSvgHtml() ?? null
    const html = buildPnlAnalyticsPdfDocumentForPrint(data.value, svg)
    const iframe = document.createElement('iframe')
    iframe.setAttribute('style', 'position:fixed;width:0;height:0;border:0;visibility:hidden')
    document.body.appendChild(iframe)
    iframe.srcdoc = html
    iframe.onload = () => {
      iframe.contentWindow?.print()
      setTimeout(() => iframe.remove(), 1000)
    }
  } catch {
    // silent
  }
}
</script>
