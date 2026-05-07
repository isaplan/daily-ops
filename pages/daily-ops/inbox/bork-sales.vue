<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Bork Daily Sales Reports</h1>
        <p class="text-gray-600 mt-2">Revenue from Basis Report emails (ground truth)</p>
      </div>

      <!-- Filters -->
      <div
        v-if="!loading && reports.length > 0"
        class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div class="mb-3 flex items-center gap-2 text-gray-700">
          <UIcon name="i-lucide-filter" class="h-5 w-5 shrink-0" aria-hidden="true" />
          <span class="text-sm font-semibold">Filters</span>
        </div>
        <div class="flex flex-wrap items-end gap-4">
          <div class="min-w-[200px] flex-1 space-y-1">
            <label class="text-xs font-medium text-gray-600">Location</label>
            <USelectMenu
              v-model="filterLocation"
              :items="locationOptions"
              value-attribute="value"
              class="w-full"
            />
          </div>
          <div class="min-w-[200px] flex-1 space-y-1">
            <label class="text-xs font-medium text-gray-600">Cron time (Amsterdam)</label>
            <USelectMenu
              v-model="filterCronHour"
              :items="cronHourOptions"
              value-attribute="value"
              class="w-full"
            />
          </div>
          <UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="clearFilters">
            Clear
          </UButton>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="text-lg text-gray-600">Loading sales reports...</div>
      </div>

      <!-- Error State -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p class="text-red-800">{{ error }}</p>
      </div>

      <!-- Sales Reports Table -->
      <div v-if="!loading && filteredReports.length > 0" class="space-y-4">
        <div
          v-for="report in filteredReports"
          :key="`${report.date}-${report.location}`"
          class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
        >
          <!-- Report Header (Collapsible) -->
          <button
            @click="toggleReport(report.date, report.location)"
            class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div class="text-left flex-1">
              <div class="flex items-center gap-4">
                <div>
                  <h3 class="font-semibold text-gray-900">{{ report.location_raw || report.location }}</h3>
                  <p class="text-sm text-gray-500">
                    {{ formatDate(report.date) }}
                    <span
                      v-if="typeof report.cron_hour === 'number'"
                      class="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                      title="Time in Europe/Amsterdam: batch time from the email subject when present, otherwise the hour the message was received"
                    >
                      {{ report.cron_hour }}:00 Amsterdam
                    </span>
                    <span
                      v-if="typeof report.business_hour === 'number'"
                      class="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded"
                      title="Register-style hour index (08:00 Amsterdam open = 0), aligned with Bork aggregates"
                    >
                      Business hour: {{ report.business_hour }}:00
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-6">
              <div class="text-right">
                <p class="text-lg font-bold text-green-600">€{{ formatCurrency(report.final_revenue_incl_vat) }}</p>
                <p class="text-xs text-gray-500">ex VAT: €{{ formatCurrency(report.final_revenue_ex_vat) }}</p>
              </div>
              <svg
                :class="[
                  'w-5 h-5 shrink-0 text-gray-400 transition-transform duration-200',
                  expandedReports.has(`${report.date}-${report.location}`) && 'rotate-180',
                ]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          <!-- Report Details (Expandable) -->
          <div
            v-if="expandedReports.has(`${report.date}-${report.location}`)"
            class="border-t border-gray-200 bg-gray-50"
          >
            <div class="px-6 py-4 space-y-6">
              <!-- Metadata -->
              <div class="bg-white rounded border border-gray-100 p-3 text-xs space-y-1">
                <div v-if="report.location_id" class="text-gray-600">Location ID: <code class="bg-gray-100 px-2 py-1 rounded">{{ report.location_id }}</code></div>
                <div v-if="report.metadata?.email_subject" class="text-gray-600">Subject: {{ report.metadata.email_subject }}</div>
              </div>

              <!-- Netto Sales Section -->
              <div v-if="report.sections?.netto_sales" class="space-y-3">
                <h4 class="font-semibold text-gray-900">Netto Sales (Products)</h4>
                <div class="bg-white rounded border border-gray-200 overflow-hidden">
                  <table class="w-full text-sm">
                    <thead class="bg-gray-100 border-b">
                      <tr>
                        <th class="px-4 py-2 text-left">Product</th>
                        <th class="px-4 py-2 text-right">Qty</th>
                        <th class="px-4 py-2 text-right">Inc VAT</th>
                        <th class="px-4 py-2 text-right">Ex VAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(cat, i) in report.sections.netto_sales.categories"
                        :key="`cat-${i}`"
                        class="border-b hover:bg-gray-50"
                      >
                        <td class="px-4 py-2 font-medium text-gray-900">{{ cat.name }}</td>
                        <td class="px-4 py-2 text-right text-gray-600">{{ cat.quantity }}</td>
                        <td class="px-4 py-2 text-right text-gray-900">€{{ formatCurrency(cat.price_incl_vat) }}</td>
                        <td class="px-4 py-2 text-right text-gray-600">€{{ formatCurrency(cat.price_ex_vat) }}</td>
                      </tr>
                      <tr v-if="report.sections.netto_sales.grand_total" class="bg-green-50 font-bold border-b-2">
                        <td class="px-4 py-2">Grand Total</td>
                        <td class="px-4 py-2 text-right">{{ report.sections.netto_sales.grand_total.quantity }}</td>
                        <td class="px-4 py-2 text-right text-green-700">
                          €{{ formatCurrency(report.sections.netto_sales.grand_total.price_incl_vat) }}
                        </td>
                        <td class="px-4 py-2 text-right text-green-600">
                          €{{ formatCurrency(report.sections.netto_sales.grand_total.price_ex_vat) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Payments Section -->
              <div v-if="report.sections?.payments" class="space-y-3">
                <h4 class="font-semibold text-gray-900">Payment Methods</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div
                    v-for="method in report.sections.payments.methods"
                    :key="method.method"
                    class="bg-white rounded border border-gray-200 p-3 flex justify-between"
                  >
                    <span class="text-gray-600">{{ method.method }}</span>
                    <span class="font-semibold text-gray-900">{{ method.quantity }}</span>
                  </div>
                </div>
              </div>

              <!-- Corrections Section -->
              <div v-if="report.sections?.corrections && report.sections.corrections.adjustments.length > 0" class="space-y-3">
                <h4 class="font-semibold text-gray-900">Corrections</h4>
                <div class="bg-white rounded border border-gray-200 overflow-hidden">
                  <table class="w-full text-sm">
                    <thead class="bg-gray-100 border-b">
                      <tr>
                        <th class="px-4 py-2 text-left">User</th>
                        <th class="px-4 py-2 text-left text-xs">Action</th>
                        <th class="px-4 py-2 text-right">Qty</th>
                        <th class="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(adj, i) in report.sections.corrections.adjustments"
                        :key="`adj-${i}`"
                        class="border-b hover:bg-gray-50"
                      >
                        <td class="px-4 py-2">
                          <div class="font-medium">{{ adj.user_raw || adj.user }}</div>
                          <div v-if="adj.user_id" class="text-xs text-gray-500">{{ adj.user_id }}</div>
                        </td>
                        <td class="px-4 py-2 text-xs text-gray-500">{{ adj.action || '—' }}</td>
                        <td class="px-4 py-2 text-right text-red-600">{{ adj.quantity }}</td>
                        <td class="px-4 py-2 text-right text-red-600">€{{ formatCurrency(adj.price_incl_vat) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Internal Sales Section -->
              <div v-if="report.sections?.internal_sales" class="space-y-3">
                <h4 class="font-semibold text-gray-900">Internal Sales (Staff)</h4>
                <div class="bg-white rounded border border-gray-200 overflow-hidden">
                  <table class="w-full text-sm">
                    <thead class="bg-gray-100 border-b">
                      <tr>
                        <th class="px-4 py-2 text-left">Staff</th>
                        <th class="px-4 py-2 text-right">Qty</th>
                        <th class="px-4 py-2 text-right">Inc VAT</th>
                        <th class="px-4 py-2 text-right">Ex VAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(staff, i) in report.sections.internal_sales.staff"
                        :key="`staff-${i}`"
                        class="border-b hover:bg-gray-50"
                      >
                        <td class="px-4 py-2">
                          <div class="font-medium">{{ staff.user_raw || staff.user }}</div>
                          <div v-if="staff.user_id" class="text-xs text-gray-500">{{ staff.user_id }}</div>
                        </td>
                        <td class="px-4 py-2 text-right">{{ staff.quantity }}</td>
                        <td class="px-4 py-2 text-right">€{{ formatCurrency(staff.price_incl_vat || 0) }}</td>
                        <td class="px-4 py-2 text-right">€{{ formatCurrency(staff.price_ex_vat || 0) }}</td>
                      </tr>
                      <tr v-if="report.sections.internal_sales.grand_total" class="bg-purple-50 font-bold border-b-2">
                        <td class="px-4 py-2">Total</td>
                        <td class="px-4 py-2 text-right">{{ report.sections.internal_sales.grand_total.quantity }}</td>
                        <td class="px-4 py-2 text-right text-purple-700">
                          €{{ formatCurrency(report.sections.internal_sales.grand_total.price_incl_vat) }}
                        </td>
                        <td class="px-4 py-2 text-right text-purple-600">
                          €{{ formatCurrency(report.sections.internal_sales.grand_total.price_ex_vat) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && reports.length === 0" class="text-center py-12">
        <p class="text-gray-600">No sales reports available yet</p>
      </div>
      <div v-else-if="!loading && reports.length > 0 && filteredReports.length === 0" class="text-center py-12">
        <p class="text-gray-600">No reports match the selected filters.</p>
        <UButton class="mt-4" color="neutral" variant="outline" @click="clearFilters">Clear filters</UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BasisReportData } from '~/server/utils/inbox/basis-report-mapper'

const FILTER_ALL = '__all__' as const

const reports = ref<BasisReportData[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const expandedReports = ref(new Set<string>())
const filterLocation = ref<string>(FILTER_ALL)
const filterCronHour = ref<string>(FILTER_ALL)

const locationOptions = computed(() => {
  const map = new Map<string, string>()
  for (const r of reports.value)
    map.set(r.location, r.location_raw || r.location)
  const opts = [...map.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'nl'))
    .map(([value, label]) => ({ label, value }))
  return [{ label: 'All locations', value: FILTER_ALL }, ...opts]
})

const cronHourOptions = computed(() => {
  const hours = new Set<number>()
  for (const r of reports.value) {
    if (typeof r.cron_hour === 'number') hours.add(r.cron_hour)
  }
  const opts = [...hours]
    .sort((a, b) => b - a)
    .map((h) => ({ label: `${h}:00 Amsterdam`, value: String(h) }))
  return [{ label: 'All cron times', value: FILTER_ALL }, ...opts]
})

const filteredReports = computed(() =>
  reports.value.filter((r: BasisReportData) => {
    if (filterLocation.value !== FILTER_ALL && r.location !== filterLocation.value) return false
    if (filterCronHour.value !== FILTER_ALL) {
      const want = Number(filterCronHour.value)
      if (typeof r.cron_hour !== 'number' || r.cron_hour !== want) return false
    }
    return true
  }),
)

function clearFilters() {
  filterLocation.value = FILTER_ALL
  filterCronHour.value = FILTER_ALL
}

onMounted(async () => {
  try {
    loading.value = true
    const response = await $fetch<{ success: boolean; data?: BasisReportData[] }>(
      '/api/bork/sales?limit=300',
    )
    if (response.success) {
      reports.value = response.data ?? []
    } else {
      error.value = 'Failed to load sales reports'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error loading reports'
  } finally {
    loading.value = false
  }
})

function toggleReport(date: string, location: string) {
  const key = `${date}-${location}`
  if (expandedReports.value.has(key)) {
    expandedReports.value.delete(key)
  } else {
    expandedReports.value.add(key)
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('nl-NL', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2).replace('.', ',')
}
</script>
