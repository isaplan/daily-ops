<template>
  <DailyOpsDashboardShell>
    <div class="space-y-6">
      <header>
        <h1 class="text-2xl font-bold text-gray-900">Revenue</h1>
        <p class="text-sm text-gray-600">Alle bedragen excl. BTW</p>
      </header>

      <RevenueFilterBar />

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

      <div v-if="isLoading" class="text-sm text-gray-500">Laden…</div>

      <!-- Overview -->
      <section v-else-if="activeTab === 'overview'" class="space-y-6">
        <div v-if="summary.data" class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p class="text-xs font-semibold uppercase text-gray-500">Omzet</p>
            <p class="text-2xl font-bold">{{ formatEur(summary.data.revenue) }}</p>
            <RevenueDeltaBadge v-if="summary.data.compareDelta" :delta="summary.data.compareDelta" />
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p class="text-xs font-semibold uppercase text-gray-500">Stuks</p>
            <p class="text-2xl font-bold">{{ summary.data.itemsCount.toLocaleString('nl-NL') }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p class="text-xs font-semibold uppercase text-gray-500">€ / stuk</p>
            <p class="text-2xl font-bold">{{ formatEur(summary.data.revenuePerItem) }}</p>
          </div>
        </div>

        <div v-if="pnl.data" class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 class="mb-3 text-lg font-semibold">Eenvoudige P&amp;L</h2>
          <table class="w-full max-w-md text-sm">
            <tbody>
              <tr><td class="py-1">Omzet</td><td class="text-right font-medium">{{ formatEur(pnl.data.revenue) }}</td></tr>
              <tr><td class="py-1">Inkoop keuken ({{ pnl.data.assumptions.foodCogsPct }}%)</td><td class="text-right text-red-700">−{{ formatEur(pnl.data.foodCogs) }}</td></tr>
              <tr><td class="py-1">Inkoop drank ({{ pnl.data.assumptions.bevCogsPct }}%)</td><td class="text-right text-red-700">−{{ formatEur(pnl.data.bevCogs) }}</td></tr>
              <tr><td class="py-1">Personeel (geladen)</td><td class="text-right text-red-700">−{{ formatEur(pnl.data.laborCost) }}</td></tr>
              <tr><td class="py-1">Vaste lasten ({{ pnl.data.assumptions.overheadPct }}%)</td><td class="text-right text-red-700">−{{ formatEur(pnl.data.overhead) }}</td></tr>
              <tr class="border-t font-bold"><td class="py-2">Resultaat</td><td class="text-right py-2">{{ formatEur(pnl.data.result) }}</td></tr>
            </tbody>
          </table>
          <p v-if="pnl.data.compare" class="mt-2 text-xs text-gray-500">
            Vergelijking {{ pnl.data.compare.label }}: resultaat {{ formatEur(pnl.data.compare.result) }}
          </p>
        </div>

        <div v-if="locations.data?.length" class="grid gap-6 lg:grid-cols-2">
          <D3PieChartV2
            :data="pieData"
            :width="360"
            :height="280"
          />
          <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th class="px-3 py-2">Zaak</th>
                  <th class="px-3 py-2 text-right">Omzet</th>
                  <th class="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="loc in locations.data" :key="loc.locationId" class="border-t">
                  <td class="px-3 py-2">{{ loc.locationName }}</td>
                  <td class="px-3 py-2 text-right">{{ formatEur(loc.revenue) }}</td>
                  <td class="px-3 py-2 text-right">{{ loc.pctOfTotal }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Trends -->
      <section v-else-if="activeTab === 'trends'" class="space-y-6">
        <div v-if="rollingMedians.data" class="grid gap-4 sm:grid-cols-3">
          <div
            v-for="w in rollingMedians.data.windows"
            :key="w.label"
            class="rounded-lg border border-gray-200 bg-white p-4"
          >
            <p class="text-xs font-semibold uppercase text-gray-500">{{ w.label }} mediaan</p>
            <p class="text-xl font-bold">{{ formatEur(w.median) }}</p>
            <p class="text-xs text-gray-500">μ {{ formatEur(w.mean) }} · P25 {{ formatEur(w.p25) }}</p>
          </div>
        </div>

        <div v-if="timeseries.data?.current.length" class="overflow-x-auto rounded-lg border border-gray-200 bg-white p-4">
          <h2 class="mb-2 text-sm font-semibold">Omzet per dag</h2>
          <table class="min-w-full text-sm">
            <thead><tr class="text-left text-xs text-gray-500"><th class="py-1">Datum</th><th class="py-1 text-right">Omzet</th><th class="py-1 text-right">Stuks</th></tr></thead>
            <tbody>
              <tr v-for="p in timeseries.data.current" :key="p.date" class="border-t">
                <td class="py-1">{{ p.date }}</td>
                <td class="py-1 text-right">{{ formatEur(p.revenue) }}</td>
                <td class="py-1 text-right">{{ p.itemsCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <div class="mb-2 flex items-center gap-2">
            <label class="text-sm font-medium">Weekdag</label>
            <select v-model="weekdayPick" class="rounded border px-2 py-1 text-sm">
              <option value="monday">Maandag</option>
              <option value="tuesday">Dinsdag</option>
              <option value="wednesday">Woensdag</option>
              <option value="thursday">Donderdag</option>
              <option value="friday">Vrijdag</option>
              <option value="saturday">Zaterdag</option>
              <option value="sunday">Zondag</option>
            </select>
          </div>
          <table v-if="weekdayRows.data?.length" class="min-w-full text-sm">
            <thead><tr class="text-left text-xs text-gray-500"><th>Datum</th><th class="text-right">Omzet</th><th class="text-right">VJ</th><th class="text-right">%</th></tr></thead>
            <tbody>
              <tr v-for="r in weekdayRows.data" :key="r.date" class="border-t">
                <td class="py-1">{{ r.date }}</td>
                <td class="py-1 text-right">{{ formatEur(r.revenue) }}</td>
                <td class="py-1 text-right">{{ r.compareRevenue != null ? formatEur(r.compareRevenue) : '—' }}</td>
                <td class="py-1 text-right">{{ r.comparePct != null ? `${r.comparePct}%` : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Hourly & Mix -->
      <section v-else-if="activeTab === 'hourly'" class="space-y-6">
        <div v-if="categories.data?.length" class="grid gap-4 sm:grid-cols-2">
          <D3PieChartV2 :data="categoryPie" :width="320" :height="260" />
          <ul class="text-sm space-y-1">
            <li v-for="c in categories.data" :key="c.name">{{ c.name }}: {{ formatEur(c.revenue) }} ({{ c.pctOfTotal }}%)</li>
          </ul>
        </div>

        <div v-if="products.data?.length" class="overflow-x-auto rounded-lg border bg-white">
          <h2 class="px-4 pt-4 text-sm font-semibold">Top 20 producten</h2>
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr><th class="px-3 py-2">Product</th><th class="px-3 py-2 text-right">Omzet</th><th class="px-3 py-2 text-right">Stuks</th></tr>
            </thead>
            <tbody>
              <tr v-for="p in products.data" :key="p.productName" class="border-t">
                <td class="px-3 py-2">{{ p.productName }}</td>
                <td class="px-3 py-2 text-right">{{ formatEur(p.revenue) }}</td>
                <td class="px-3 py-2 text-right">{{ p.itemsCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="hourlyMatrix.data?.rows.length" class="overflow-x-auto">
          <p class="mb-2 text-sm text-gray-600">Omzet per uur × weekdag (heatmap als tabel)</p>
          <table class="text-xs border-collapse">
            <thead>
              <tr>
                <th class="border px-1">Uur</th>
                <th v-for="d in dowLabels" :key="d" class="border px-1">{{ d }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in hourlyMatrix.data.rows" :key="row.hour">
                <td class="border px-1 font-medium">{{ row.hour }}</td>
                <td
                  v-for="(cell, ci) in row.weekdays"
                  :key="ci"
                  class="border px-1 text-right"
                  :class="heatClass(cell.revenue)"
                >
                  {{ cell.revenue > 0 ? formatEur(cell.revenue) : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="coOccurrence.data?.note" class="text-sm text-gray-500">{{ coOccurrence.data.note }}</p>
      </section>

      <!-- Dimensions (on revenue page per plan tab 4 - staff/table moved to productivity but plan tab 4 includes dimensions) -->
      <section v-else-if="activeTab === 'dimensions'" class="space-y-6">
        <div v-if="locationSpaces.data?.length" class="rounded-lg border bg-white p-4">
          <h2 class="mb-2 font-semibold">Per ruimte</h2>
          <table class="min-w-full text-sm">
            <tbody>
              <tr v-for="s in locationSpaces.data" :key="s.space" class="border-t">
                <td class="py-2">{{ s.space }}</td>
                <td class="py-2 text-right">{{ formatEur(s.revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-sm text-gray-600">
          Personeel, tafels en werkdruk (order vs betaling) staan op
          <NuxtLink to="/daily-ops/productivity" class="font-semibold underline">Productivity</NuxtLink>.
        </p>
      </section>
    </div>
  </DailyOpsDashboardShell>
</template>

<script setup lang="ts">
const { formatEur } = useDashboardEurFormat()
const {
  summary,
  pnl,
  locations,
  timeseries,
  rollingMedians,
  categories,
  products,
  hourlyMatrix,
  coOccurrence,
  locationSpaces,
  revenueQuery,
} = useDailyOpsRevenueMetrics()

const tabs = [
  { id: 'overview', label: 'Overzicht' },
  { id: 'trends', label: 'Trends' },
  { id: 'hourly', label: 'Uur & mix' },
  { id: 'dimensions', label: 'Ruimtes' },
] as const

type TabId = (typeof tabs)[number]['id']
const activeTab = ref<TabId>('overview')
const weekdayPick = ref('monday')
const weekdayQs = computed(() => {
  const base = new URLSearchParams(revenueQuery.value).toString()
  return `${base}&weekday=${weekdayPick.value}`
})
const weekdayRows = useFetch(
  () => `/api/daily-ops/revenue/weekday-pattern?${weekdayQs.value}`,
  { watch: [weekdayQs], key: () => `rev-wd-${weekdayQs.value}` },
)

const dowLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

const isLoading = computed(
  () =>
    summary.pending.value ||
    pnl.pending.value ||
    locations.pending.value,
)

const pieData = computed(() =>
  (locations.data.value ?? []).map((l) => ({ label: l.locationName, value: l.revenue })),
)

const categoryPie = computed(() =>
  (categories.data.value ?? []).slice(0, 8).map((c) => ({ label: c.name, value: c.revenue })),
)

function heatClass(revenue: number): string {
  if (revenue <= 0) return 'bg-gray-50'
  if (revenue < 500) return 'bg-green-50'
  if (revenue < 1500) return 'bg-green-100'
  if (revenue < 3000) return 'bg-green-200'
  return 'bg-green-300'
}
</script>
