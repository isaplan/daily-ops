<template>
  <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
    <template #header>
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-gray-900">{{ title }}</h2>
        <p class="text-[11px] leading-snug text-gray-500">
          {{ data.estimatesNote }}
        </p>
      </div>
    </template>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Hour</p>
        <p class="mt-1 text-lg font-semibold text-gray-900">{{ data.hourLabel }}</p>
      </div>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Revenue</p>
        <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(data.revenue) }}</p>
      </div>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Labor</p>
        <p class="text-[10px] text-gray-400">shift times</p>
        <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(data.laborCost) }}</p>
      </div>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Cost of Sales</p>
        <p class="text-[10px] text-gray-400">avg 30%</p>
        <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(data.cogsCost) }}</p>
      </div>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Fixed Costs</p>
        <p class="text-[10px] text-gray-400">avg 25%</p>
        <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(data.fixedCost) }}</p>
      </div>
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Results (est.)</p>
        <p class="mt-1 text-lg font-semibold text-gray-900">{{ formatEur(data.profit) }}</p>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { DailyOpsProfitHourDto } from '~/types/daily-ops-dashboard'

defineProps<{
  title: string
  data: DailyOpsProfitHourDto
}>()

const { formatEur } = useDashboardEurFormat()
</script>
