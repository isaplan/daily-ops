<template>
  <DailyOpsDashboardShell>
    <div class="space-y-8">
      <header class="space-y-2">
        <h1 class="text-[38px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
          Daily Ops / {{ locationTitle }} / Dashboard
        </h1>
        <p class="text-xl font-medium text-gray-700">
          {{ contextHeadline }}
        </p>
        <p v-if="summary?.vatDisclaimer" class="text-base italic text-gray-500">
          {{ summary.vatDisclaimer }}
        </p>
      </header>

      <UAlert v-if="error" color="error" variant="soft" title="Could not load dashboard" :description="String(error)" />

      <div v-if="pending" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <USkeleton v-for="i in 4" :key="i" class="h-28 w-full rounded-lg" />
      </div>

      <template v-else-if="summary && revenue && labor">
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <UCard class="border-2 border-gray-900 bg-white">
            <p class="text-sm font-medium text-gray-500">Total Revenue</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ formatEur(summary.summary.totalRevenue) }}</p>
          </UCard>
          <UCard class="border-2 border-gray-900 bg-white">
            <p class="text-sm font-medium text-gray-500">Total Labor Cost</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ formatEur(summary.summary.totalLaborCost) }}</p>
            <p v-if="summary.summary.laborCostPctOfRevenue != null" class="mt-1 text-xs text-gray-500">
              {{ summary.summary.laborCostPctOfRevenue.toFixed(1) }}% of revenue
            </p>
          </UCard>
          <UCard class="border-2 border-gray-900 bg-white">
            <p class="text-sm font-medium text-gray-500">Profit</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ formatEur(summary.summary.profit) }}</p>
          </UCard>
          <UCard class="border-2 border-gray-900 bg-white">
            <p class="text-sm font-medium text-gray-500">Profit Margin</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ summary.summary.profitMarginPct.toFixed(1) }}%</p>
            <p v-if="summary.summary.revenuePerLaborHour != null" class="mt-1 text-xs text-gray-500">
              {{ formatEur(summary.summary.revenuePerLaborHour) }} / labor hour
            </p>
          </UCard>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold text-gray-900">Revenue by Category</h2>
            </template>
            <p class="mb-3 text-xs text-gray-500">Drinks vs food uses product-name keywords on Bork lines (see data notes below).</p>
            <ul class="divide-y divide-gray-100">
              <li
                v-for="row in revenue.revenueByCategory"
                :key="row.key"
                class="flex items-center justify-between py-3 text-sm"
              >
                <span class="font-medium text-gray-700">{{ row.label }}</span>
                <span class="tabular-nums text-gray-900">{{ formatEur(row.amount) }}</span>
              </li>
            </ul>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold text-gray-900">Revenue by Time Period</h2>
            </template>
            <ul class="divide-y divide-gray-100">
              <li
                v-for="row in revenue.revenueByTimePeriod"
                :key="row.key"
                class="flex items-center justify-between py-3 text-sm"
              >
                <span class="font-medium text-gray-700">{{ row.label }}</span>
                <span class="tabular-nums text-gray-900">{{ formatEur(row.amount) }}</span>
              </li>
            </ul>
          </UCard>
        </div>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900">Most Profitable Hour</h2>
          </template>
          <p class="mb-4 text-xs text-gray-500">Labor cost for the hour is estimated by splitting each day’s total labor across hours by revenue share.</p>
          <div class="grid gap-4 sm:grid-cols-4">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Hour</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ revenue.mostProfitableHour.hourLabel }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Revenue</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(revenue.mostProfitableHour.revenue) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Labor Cost (est.)</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(revenue.mostProfitableHour.laborCost) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Profit</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(revenue.mostProfitableHour.profit) }}</p>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900">Labor — Period Rollup</h2>
          </template>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p class="text-xs font-medium text-gray-500">Revenue (range)</p>
              <p class="mt-1 text-lg font-semibold">{{ formatEur(labor.periodRollup.revenue) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500">Labor cost</p>
              <p class="mt-1 text-lg font-semibold">{{ formatEur(labor.periodRollup.laborCost) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500">Hours worked</p>
              <p class="mt-1 text-lg font-semibold">{{ labor.periodRollup.hours.toFixed(1) }} h</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500">€ / labor hour</p>
              <p class="mt-1 text-lg font-semibold">
                {{ labor.periodRollup.revenuePerLaborHour != null ? formatEur(labor.periodRollup.revenuePerLaborHour) : '—' }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900">Labor — By Day</h2>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr class="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th class="pb-2 pr-4 font-medium">Date</th>
                  <th class="pb-2 pr-4 font-medium">Revenue</th>
                  <th class="pb-2 pr-4 font-medium">Labor</th>
                  <th class="pb-2 pr-4 font-medium">Hours</th>
                  <th class="pb-2 pr-4 font-medium">Labor % rev.</th>
                  <th class="pb-2 font-medium">€ / h</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in labor.daily" :key="row.date" class="border-b border-gray-100">
                  <td class="py-2 pr-4 font-medium text-gray-800">{{ row.date }}</td>
                  <td class="py-2 pr-4 tabular-nums">{{ formatEur(row.revenue) }}</td>
                  <td class="py-2 pr-4 tabular-nums">{{ formatEur(row.laborCost) }}</td>
                  <td class="py-2 pr-4 tabular-nums">{{ row.hours.toFixed(1) }}</td>
                  <td class="py-2 pr-4 tabular-nums">
                    {{ row.laborCostPctOfRevenue != null ? `${row.laborCostPctOfRevenue.toFixed(1)}%` : '—' }}
                  </td>
                  <td class="py-2 tabular-nums">
                    {{ row.revenuePerLaborHour != null ? formatEur(row.revenuePerLaborHour) : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <div class="grid gap-6 lg:grid-cols-2">
          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold text-gray-900">Workers by Team &amp; Location</h2>
            </template>
            <div class="max-h-80 overflow-y-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <th class="pb-2 pr-2 font-medium">Location</th>
                    <th class="pb-2 pr-2 font-medium">Team</th>
                    <th class="pb-2 pr-2 font-medium">Staff</th>
                    <th class="pb-2 pr-2 font-medium">Hours</th>
                    <th class="pb-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, i) in labor.workersByTeamLocation"
                    :key="`${row.locationId}-${row.teamId}-${i}`"
                    class="border-b border-gray-50"
                  >
                    <td class="py-2 pr-2">{{ row.locationName }}</td>
                    <td class="py-2 pr-2">{{ row.teamName }}</td>
                    <td class="py-2 pr-2 tabular-nums">{{ row.workerCount }}</td>
                    <td class="py-2 pr-2 tabular-nums">{{ row.totalHours.toFixed(1) }}</td>
                    <td class="py-2 tabular-nums">{{ formatEur(row.totalCost) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold text-gray-900">Hours &amp; Cost by Contract Type</h2>
            </template>
            <p class="mb-3 text-xs text-gray-500">Contract type is resolved from the members collection via Eitje user id.</p>
            <ul class="divide-y divide-gray-100">
              <li
                v-for="row in labor.hoursCostByContractType"
                :key="row.contractType"
                class="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <span class="font-medium text-gray-700">{{ row.contractType || '—' }}</span>
                <span class="tabular-nums text-gray-600">{{ row.totalHours.toFixed(1) }} h · {{ formatEur(row.totalCost) }}</span>
              </li>
            </ul>
          </UCard>
        </div>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900">Labor Productivity — Best &amp; Worst Day (per Location)</h2>
          </template>
          <p class="mb-4 text-xs text-gray-500">Revenue per worked hour (€/h) for days with both Bork revenue and Eitje hours for that location.</p>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr class="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th class="pb-2 pr-4 font-medium">Location</th>
                  <th class="pb-2 pr-4 font-medium">Highest €/h</th>
                  <th class="pb-2 pr-4 font-medium">Date</th>
                  <th class="pb-2 pr-4 font-medium">Lowest €/h</th>
                  <th class="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in labor.productivityByLocationDay"
                  :key="row.locationId"
                  class="border-b border-gray-100"
                >
                  <td class="py-2 pr-4 font-medium">{{ row.locationName }}</td>
                  <td class="py-2 pr-4 tabular-nums">
                    {{ row.highest ? formatEur(row.highest.revenuePerLaborHour) : '—' }}
                  </td>
                  <td class="py-2 pr-4 text-gray-600">{{ row.highest?.date ?? '—' }}</td>
                  <td class="py-2 pr-4 tabular-nums">
                    {{ row.lowest ? formatEur(row.lowest.revenuePerLaborHour) : '—' }}
                  </td>
                  <td class="py-2 text-gray-600">{{ row.lowest?.date ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <UCard v-if="labor.inventory.notes.length" class="border border-amber-200 bg-amber-50/80">
          <template #header>
            <h2 class="text-lg font-semibold text-gray-900">Data Coverage &amp; Method Notes</h2>
          </template>
          <ul class="list-inside list-disc space-y-1 text-sm text-gray-700">
            <li v-for="(note, i) in labor.inventory.notes" :key="i">{{ note }}</li>
          </ul>
          <p class="mt-3 text-xs text-gray-500">
            Flags: bork_sales_by_cron {{ labor.inventory.hasBorkCronData ? 'yes' : 'no' }}, bork_sales_by_hour
            {{ labor.inventory.hasBorkHourData ? 'yes' : 'no' }}, eitje_time_registration_aggregation
            {{ labor.inventory.hasEitjeAggData ? 'yes' : 'no' }}.
          </p>
        </UCard>

        <p class="text-xs text-gray-400">
          Range: {{ summary.range.startDate }} → {{ summary.range.endDate }} ({{ summary.range.period }}) · Parallel metrics
          API for faster loads on mobile.
        </p>
      </template>
    </div>
  </DailyOpsDashboardShell>
</template>

<script setup lang="ts">
import type {
  DailyOpsLaborMetricsDto,
  DailyOpsRevenueBreakdownDto,
  DailyOpsSummaryDto,
} from '~/types/daily-ops-dashboard'

type LocationRow = { _id: string; name: string }

const { dashboardQuery, contextHeadline, locationId } = useDailyOpsDashboardRoute()
const { formatEur } = useDashboardEurFormat()

const { data: locationsRes } = await useFetch<{ success: boolean; data: LocationRow[] }>('/api/locations')

const locationTitle = computed(() => {
  if (!locationId.value) return 'All Locations'
  const rows = locationsRes.value?.data ?? []
  const hit = rows.find((row) => row._id === locationId.value)
  return hit?.name ?? 'Selected Location'
})

const { data: summary, pending: pSum, error: eSum } = useFetch<DailyOpsSummaryDto>(
  '/api/daily-ops/metrics/summary',
  { query: dashboardQuery }
)
const { data: revenue, pending: pRev, error: eRev } = useFetch<DailyOpsRevenueBreakdownDto>(
  '/api/daily-ops/metrics/revenue-breakdown',
  { query: dashboardQuery }
)
const { data: labor, pending: pLab, error: eLab } = useFetch<DailyOpsLaborMetricsDto>(
  '/api/daily-ops/metrics/labor',
  { query: dashboardQuery }
)

const pending = computed(() => pSum.value || pRev.value || pLab.value)
const error = computed(() => eSum.value ?? eRev.value ?? eLab.value)
</script>
