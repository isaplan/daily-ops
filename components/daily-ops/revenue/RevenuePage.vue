<template>
  <DailyOpsDashboardShell>
    <div class="space-y-6">
      <header>
        <h1 class="text-2xl font-bold text-gray-900">Revenue</h1>
        <p class="text-sm text-gray-600">Alle bedragen excl. BTW</p>
      </header>

      <DailyOpsRevenueFilterBar show-export @export="onExport" />

      <nav class="flex flex-wrap gap-1 border-b border-gray-200">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="border-b-2 px-4 py-2 text-sm font-semibold transition-colors"
          :class="activeTab === tab.id
            ? 'border-gray-900 text-gray-900'
            : 'border-transparent text-gray-500 hover:text-gray-800'"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>

      <DailyOpsRevenueLoadingState v-if="tabPending" />

      <DailyOpsRevenueOverviewTab
        v-else-if="activeTab === 'overview'"
        :summary="summary"
        :pnl="pnl"
        :locations="locations"
      />
      <DailyOpsRevenueTrendsTab
        v-else-if="activeTab === 'trends'"
        :timeseries="timeseries"
        :rolling-medians="rollingMedians"
      />
      <DailyOpsRevenueHourlyMixTab
        v-else-if="activeTab === 'hourly'"
        :categories="categories"
        :products="products"
        :hourly-matrix="hourlyMatrix"
        :hourly-category-stack="hourlyCategoryStack"
        :co-occurrence="coOccurrence"
      />
      <DailyOpsRevenueDimensionsTab
        v-else-if="activeTab === 'dimensions'"
        :location-spaces="locationSpaces"
      />
    </div>
  </DailyOpsDashboardShell>
</template>

<script setup lang="ts">
const {
  summary,
  pnl,
  locations,
  timeseries,
  rollingMedians,
  categories,
  products,
  hourlyMatrix,
  hourlyCategoryStack,
  coOccurrence,
  locationSpaces,
  overviewPending,
} = useDailyOpsRevenueMetrics()

const { downloadCsv } = useDailyOpsRevenueExport()
const { formatEur } = useDashboardEurFormat()

const tabs = [
  { id: 'overview', label: 'Overzicht' },
  { id: 'trends', label: 'Trends' },
  { id: 'hourly', label: 'Uur & mix' },
  { id: 'dimensions', label: 'Ruimtes' },
] as const

type TabId = (typeof tabs)[number]['id']
const activeTab = ref<TabId>('overview')

const tabPending = computed(() => {
  if (activeTab.value === 'overview') return overviewPending.value
  return false
})

function onExport() {
  if (activeTab.value === 'overview' && summary.value) {
    downloadCsv('revenue-summary.csv', ['Metric', 'Waarde'], [
      ['Omzet', formatEur(summary.value.revenue)],
      ['Stuks', summary.value.itemsCount],
      ['€/stuk', formatEur(summary.value.revenuePerItem)],
    ])
    return
  }
  if (activeTab.value === 'trends' && timeseries.value) {
    downloadCsv(
      'revenue-timeseries.csv',
      ['Datum', 'Omzet', 'Stuks'],
      timeseries.value.current.map((p) => [p.date, p.revenue, p.itemsCount]),
    )
    return
  }
  if (activeTab.value === 'hourly' && products.value) {
    downloadCsv(
      'revenue-products.csv',
      ['Product', 'Omzet', 'Stuks'],
      products.value.map((p) => [p.productName, p.revenue, p.itemsCount]),
    )
  }
}
</script>
