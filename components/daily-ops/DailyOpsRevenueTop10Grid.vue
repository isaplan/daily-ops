<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <UCard
      v-for="list in lists"
      :key="list.key"
      class="border-2 border-gray-900 bg-white! ring-0 shadow-none"
    >
      <template #header>
        <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-600">{{ list.title }}</h3>
      </template>

      <ol
        v-if="list.rows.length"
        class="space-y-2"
      >
        <li
          v-for="(row, index) in list.rows"
          :key="`${list.key}-${row.label}-${index}`"
          class="flex items-start justify-between gap-3 border-b border-gray-100 pb-2 last:border-b-0 last:pb-0"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-gray-900">
              {{ index + 1 }}. {{ row.label }}
            </p>
            <p
              v-if="row.subLabel"
              class="truncate text-xs text-gray-500"
            >
              {{ row.subLabel }}
            </p>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-sm font-semibold text-gray-900">{{ formatEur(row.revenue) }}</p>
            <p class="text-xs text-gray-500">{{ formatQty(row.quantity) }} qty</p>
          </div>
        </li>
      </ol>
      <p
        v-else
        class="py-8 text-center text-sm text-gray-500"
      >
        No snapshot rows available yet.
      </p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { DailyOpsRevenueDrilldownDto } from '~/types/daily-ops-dashboard'

const props = defineProps<{
  top10: DailyOpsRevenueDrilldownDto['top10']
}>()

const { formatEur } = useDashboardEurFormat()

const lists = computed(() => [
  { key: 'workers', title: 'Top 10 Workers', rows: props.top10.workers },
  { key: 'tables', title: 'Top 10 Tables', rows: props.top10.tables },
  { key: 'food', title: 'Top 10 Food Products', rows: props.top10.foodProducts },
  { key: 'beverage', title: 'Top 10 Beverage Products / Categories', rows: props.top10.beverageProductsOrCategories },
])

function formatQty(value: number): string {
  return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(value)
}
</script>
