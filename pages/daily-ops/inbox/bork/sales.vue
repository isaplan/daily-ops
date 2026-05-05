<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Bork Daily Sales Reports</h1>
        <p class="text-gray-600 mt-2">Revenue tracking by day, location, and payment method</p>
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
      <div v-if="!loading && reports.length > 0" class="space-y-4">
        <div
          v-for="report in reports"
          :key="`${report.date}-${report.location}`"
          class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
        >
          <!-- Report Header (Collapsible) -->
          <button
            @click="toggleReport(report.date, report.location)"
            class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div class="text-left">
              <div class="flex items-center gap-4">
                <div>
                  <h3 class="font-semibold text-gray-900">{{ report.location }}</h3>
                  <p class="text-sm text-gray-500">{{ formatDate(report.date) }}</p>
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
                  'w-5 h-5 text-gray-400 transition-transform',
                  expandedReports.has(`${report.date}-${report.location}`) && 'rotate-180',
                ]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </button>

          <!-- Report Details (Expandable) -->
          <div
            v-if="expandedReports.has(`${report.date}-${report.location}`)"
            class="border-t border-gray-200 bg-gray-50"
          >
            <div class="px-6 py-4 space-y-6">
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
                        <th class="px-4 py-2 text-left">User/Action</th>
                        <th class="px-4 py-2 text-right">Qty</th>
                        <th class="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="adj in report.sections.corrections.adjustments"
                        :key="`adj-${adj.user}`"
                        class="border-b hover:bg-gray-50"
                      >
                        <td class="px-4 py-2">{{ adj.user }} <span v-if="adj.action" class="text-xs text-gray-500">({{ adj.action }})</span></td>
                        <td class="px-4 py-2 text-right text-red-600">{{ adj.quantity }}</td>
                        <td class="px-4 py-2 text-right text-red-600">€{{ formatCurrency(adj.price_incl_vat) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Internal Sales Section -->
              <div v-if="report.sections?.internal_sales" class="space-y-3">
                <h4 class="font-semibold text-gray-900">Internal Sales</h4>
                <div class="bg-white rounded border border-gray-200 overflow-hidden">
                  <table class="w-full text-sm">
                    <thead class="bg-gray-100 border-b">
                      <tr>
                        <th class="px-4 py-2 text-left">Staff</th>
                        <th class="px-4 py-2 text-right">Qty</th>
                        <th class="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="staff in report.sections.internal_sales.staff"
                        :key="`staff-${staff.user}`"
                        class="border-b hover:bg-gray-50"
                      >
                        <td class="px-4 py-2 font-medium">{{ staff.user }}</td>
                        <td class="px-4 py-2 text-right">{{ staff.quantity }}</td>
                        <td class="px-4 py-2 text-right">€{{ formatCurrency(staff.price_incl_vat || 0) }}</td>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BasisReportData } from '~/server/utils/inbox/basis-report-mapper'

const reports = ref<BasisReportData[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const expandedReports = ref(new Set<string>())

onMounted(async () => {
  try {
    loading.value = true
    const response = await $fetch('/api/bork/sales?limit=30')
    if (response.success) {
      reports.value = response.data || []
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
    return date.toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2).replace('.', ',')
}
</script>
