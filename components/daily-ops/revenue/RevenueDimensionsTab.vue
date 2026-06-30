<template>
  <section class="space-y-6">
    <div v-if="locationSpaces?.length" class="rounded-lg border bg-white p-4">
      <h2 class="mb-2 font-semibold">Per ruimte</h2>
      <table class="min-w-full text-sm">
        <thead class="text-left text-xs uppercase text-gray-500">
          <tr>
            <th class="py-2">Ruimte</th>
            <th class="py-2 text-right">Omzet</th>
            <th class="py-2 text-right">Stuks</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in locationSpaces" :key="s.space" class="border-t">
            <td class="py-2 capitalize">{{ s.space }}</td>
            <td class="py-2 text-right">{{ formatEur(s.revenue) }}</td>
            <td class="py-2 text-right">{{ s.itemsCount }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-sm text-gray-600">
      Personeel, tafels en werkdruk (order vs betaling) staan op
      <NuxtLink to="/daily-ops/staff/productivity" class="font-semibold underline">Productivity</NuxtLink>.
    </p>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  locationSpaces: Array<{
    space: string
    revenue: number
    itemsCount: number
    revenuePerItem: number
  }> | null
}>()
const { formatEur } = useDashboardEurFormat()
</script>
