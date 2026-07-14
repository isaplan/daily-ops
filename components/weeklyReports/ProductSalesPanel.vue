<template>
  <div v-if="digest" class="space-y-4">
    <div>
      <h3 class="mb-2 text-sm font-semibold text-gray-700">Top products</h3>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-gray-500">
            <th class="py-1">Product</th>
            <th>Qty</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in digest.topProducts.slice(0, 10)" :key="row.productName" class="border-t border-gray-100">
            <td class="py-1">{{ row.productName }}</td>
            <td>{{ row.quantity }}</td>
            <td>{{ formatEur(row.revenue) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="digest.upsell.length">
      <h3 class="mb-2 text-sm font-semibold text-gray-700">Upsell (water / beer / lemonade)</h3>
      <ul class="space-y-1 text-sm">
        <li v-for="u in digest.upsell" :key="u.label">
          {{ u.label }}: {{ u.quantity }} · {{ formatEur(u.revenue) }}
        </li>
      </ul>
    </div>
    <div v-if="digest.staffRankings.length">
      <h3 class="mb-2 text-sm font-semibold text-gray-700">Staff rankings (revenue)</h3>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-gray-500">
            <th class="py-1">Staff</th>
            <th>Revenue</th>
            <th>Items</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in digest.staffRankings.slice(0, 10)" :key="s.workerName" class="border-t border-gray-100">
            <td class="py-1">{{ s.workerName }}</td>
            <td>{{ formatEur(s.revenue) }}</td>
            <td>{{ s.itemsCount }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WeeklyDigestDto } from '~/types/daily-ops-weekly-report'

defineProps<{ digest: WeeklyDigestDto }>()

const { formatEur } = useDashboardEurFormat()
</script>
