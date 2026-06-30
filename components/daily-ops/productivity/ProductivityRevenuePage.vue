<template>
  <div class="space-y-6">
      <header>
        <h1 class="text-2xl font-bold text-gray-900">Productivity</h1>
        <p class="text-sm text-gray-600">Personeel, tafels en werkdruk · excl. BTW</p>
      </header>

      <DailyOpsRevenueFilterBar />

      <DailyOpsRevenueLoadingState v-if="overviewPending" />

      <section v-else class="space-y-8">
        <div v-if="staff?.length" class="rounded-lg border border-gray-200 bg-white p-4">
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
              <tr v-for="w in staff" :key="w.staffName" class="border-t">
                <td class="px-3 py-2">{{ w.staffName }}</td>
                <td class="px-3 py-2 text-right">{{ formatEur(w.revenue) }}</td>
                <td class="px-3 py-2 text-right">{{ w.orderCount }}</td>
                <td class="px-3 py-2 text-right">{{ w.avgProductsPerOrder.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="tables?.length" class="rounded-lg border border-gray-200 bg-white p-4">
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
              <tr v-for="t in tables.slice(0, 50)" :key="t.tableNum" class="border-t">
                <td class="px-3 py-2">{{ t.tableNum }}</td>
                <td class="px-3 py-2">{{ t.locationSpace }}</td>
                <td class="px-3 py-2 text-right">{{ formatEur(t.revenue) }}</td>
                <td class="px-3 py-2 text-right">{{ t.itemsCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <DailyOpsProductivityWorkloadChart
          v-if="orderPaymentRhythm?.length"
          :points="orderPaymentRhythm"
        />
      </section>
    </div>
</template>

<script setup lang="ts">
const { formatEur } = useDashboardEurFormat()
const { staff, tables, orderPaymentRhythm, overviewPending } = useDailyOpsProductivityRevenueMetrics()
</script>
