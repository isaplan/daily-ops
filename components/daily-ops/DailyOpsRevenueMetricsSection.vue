<template>
  <div v-if="pending" class="space-y-6">
    <USkeleton class="h-48 w-full rounded-lg" />
    <USkeleton class="h-40 w-full rounded-lg" />
  </div>
  <div v-else-if="revenue" class="space-y-6">
    <DailyOpsTodayRevenueCard :detail="revenue.todayRevenueDetail" />
    <DailyOpsProfitByIntervalCard :data="revenue.profitByInterval" :period="period" />
    <DailyOpsProfitHourCard title="Most Profitable Hour" :data="revenue.mostProfitableHour" />
    <DailyOpsRevenueDrilldownSection
      v-if="revenue.drilldown"
      :data="revenue.drilldown"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  period: string
}>()

const { revenue, pending } = useDailyOpsRevenueBreakdown()
</script>
