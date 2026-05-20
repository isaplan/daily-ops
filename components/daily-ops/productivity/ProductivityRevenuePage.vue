<template>
  <DailyOpsDashboardShell>
    <div class="space-y-6">
      <header>
        <h1 class="text-2xl font-bold text-gray-900">Productivity</h1>
        <p class="text-sm text-gray-600">Personeel, tafels en werkdruk · excl. BTW</p>
      </header>

      <RevenueFilterBar />

      <div v-if="isLoading" class="text-sm text-gray-500">Laden…</div>

      <section v-else class="space-y-8">
        <div v-if="staff.data?.length" class="rounded-lg border border-gray-200 bg-white p-4">
          <h2 class="mb-3 text-lg font-semibold">Omzet per medewerker</h2>
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th class="px-3 py-2">Naam</th>
                <th class="px-3 py-2 text-right">Omzet</th>
                <th class="px-3 py-2 text-right">Orders</th>
                <th class="px-3 py-2 text-right">Gem. producten/order</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="w in staff.data" :key="w.staffName" class="border-t">
                <td class="px-3 py-2">{{ w.staffName }}</td>
                <td class="px-3 py-2 text-right">{{ formatEur(w.revenue) }}</td>
                <td class="px-3 py-2 text-right">{{ w.orderCount }}</td>
                <td class="px-3 py-2 text-right">{{ w.avgProductsPerOrder.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="tables.data?.length" class="rounded-lg border border-gray-200 bg-white p-4">
          <h2 class="mb-3 text-lg font-semibold">Omzet per tafel</h2>
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th class="px-3 py-2">Tafel</th>
                <th class="px-3 py-2">Ruimte</th>
                <th class="px-3 py-2 text-right">Omzet</th>
                <th class="px-3 py-2 text-right">Stuks</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in tables.data.slice(0, 50)" :key="t.tableNum" class="border-t">
                <td class="px-3 py-2">{{ t.tableNum }}</td>
                <td class="px-3 py-2">{{ t.locationSpace }}</td>
                <td class="px-3 py-2 text-right">{{ formatEur(t.revenue) }}</td>
                <td class="px-3 py-2 text-right">{{ t.itemsCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="orderPaymentRhythm.data?.length" class="rounded-lg border border-gray-200 bg-white p-4">
          <h2 class="mb-3 text-lg font-semibold">Werkdruk: orders vs betalingen per uur</h2>
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th class="px-3 py-2">Uur</th>
                <th class="px-3 py-2 text-right">Orders</th>
                <th class="px-3 py-2 text-right">Betalingen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in orderPaymentRhythm.data" :key="p.hour" class="border-t">
                <td class="px-3 py-2">{{ p.hour }}:00</td>
                <td class="px-3 py-2 text-right">{{ p.orderCount }}</td>
                <td class="px-3 py-2 text-right">{{ p.paymentCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </DailyOpsDashboardShell>
</template>

<script setup lang="ts">
const { formatEur } = useDashboardEurFormat()
const { staff, tables, orderPaymentRhythm } = useDailyOpsProductivityRevenueMetrics()

const isLoading = computed(
  () => staff.pending.value || tables.pending.value || orderPaymentRhythm.pending.value,
)
</script>
