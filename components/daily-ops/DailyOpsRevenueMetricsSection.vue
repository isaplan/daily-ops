<template>
  <div v-if="pending" class="space-y-6">
    <USkeleton class="h-48 w-full rounded-lg" />
    <USkeleton class="h-40 w-full rounded-lg" />
  </div>
  <div v-else class="space-y-6">
    <DailyOpsTodayRevenueCard v-if="revenue?.todayRevenueDetail" :detail="revenue.todayRevenueDetail" />
    <DailyOpsProfitByIntervalCard
      :data="profitByInterval"
      :period="period"
    />
    <DailyOpsProfitHourCard title="Most Profitable Hour" :data="mostProfitableHour" />
    <DailyOpsRevenueDrilldownSection
      v-if="revenue?.drilldown"
      :data="revenue.drilldown"
      :primary-location-id="locationId"
      @config-saved="() => void refresh()"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  DailyOpsPeriodId,
  DailyOpsProfitByIntervalDto,
  DailyOpsProfitHourDto,
} from '~/types/daily-ops-dashboard'

defineProps<{
  period: string
}>()

const EMPTY_PROFIT_BY_INTERVAL: DailyOpsProfitByIntervalDto = {
  estimatesNote: 'No interval breakdown for this period yet.',
  dates: [],
  cells: [],
}

const EMPTY_PROFIT_HOUR: DailyOpsProfitHourDto = {
  hourLabel: '—',
  date: '',
  hour: 0,
  revenue: 0,
  laborCost: 0,
  cogsCost: 0,
  fixedCost: 0,
  profit: 0,
  estimatesNote: 'No hourly profit data for this period yet.',
}

const { dashboardQuery } = useDailyOpsDashboardRoute()
const locationId = computed(() => dashboardQuery.value.location ?? null)
const { revenue, pending, refresh } = useDailyOpsRevenueBreakdown()

const profitByInterval = computed(
  (): DailyOpsProfitByIntervalDto => revenue.value?.profitByInterval ?? EMPTY_PROFIT_BY_INTERVAL,
)
const mostProfitableHour = computed(
  (): DailyOpsProfitHourDto => revenue.value?.mostProfitableHour ?? EMPTY_PROFIT_HOUR,
)
</script>
