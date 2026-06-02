<template>
  <div v-if="pending" class="space-y-6">
    <USkeleton class="h-48 w-full rounded-lg" />
    <USkeleton class="h-40 w-full rounded-lg" />
  </div>
  <div v-else-if="revenue" class="space-y-6">
    <DailyOpsTodayRevenueCard
      v-if="revenue.todayRevenueDetail"
      :detail="revenue.todayRevenueDetail"
    />
    <DailyOpsProfitByIntervalCard
      v-if="revenue.profitByInterval?.cells?.length"
      :data="revenue.profitByInterval"
      :period="periodId"
    />
    <UAlert
      v-else
      color="warning"
      variant="soft"
      title="Profit by time of day unavailable"
      description="Dashboard data is stale or incomplete. Hard-refresh the page (Cmd+Shift+R) or click Retry on the metrics block above."
    />
    <DailyOpsProfitHourCard title="Most Profitable Hour" :data="revenue.mostProfitableHour" />
    <DailyOpsRevenueDrilldownSection
      v-if="revenue.drilldown"
      :data="revenue.drilldown"
      :primary-location-id="locationId"
      @config-saved="refresh"
    />
  </div>
</template>

<script setup lang="ts">
import type { DailyOpsPeriodId } from '~/types/daily-ops-dashboard'

const props = defineProps<{
  period: string
}>()

const { revenue, pending, refresh } = useDailyOpsRevenueBreakdown()
const { locationId } = useDailyOpsDashboardRoute()

const periodId = computed((): DailyOpsPeriodId => props.period as DailyOpsPeriodId)
</script>
