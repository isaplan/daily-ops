<template>
  <div v-if="pending" class="space-y-6">
    <USkeleton class="h-48 w-full rounded-lg" />
    <USkeleton class="h-40 w-full rounded-lg" />
  </div>
  <div v-else class="space-y-6">
    <DailyOpsTodayRevenueCard
      v-if="showHourlyRevenueCard && revenue?.todayRevenueDetail"
      :detail="revenue.todayRevenueDetail"
    />
    <DailyOpsProfitByIntervalCard
      :data="profitByInterval"
      :period="period"
    />
    <DailyOpsRevenueDrilldownSection
      v-if="revenue?.drilldown"
      :data="revenue.drilldown"
      :primary-location-id="locationId"
      @config-saved="() => void refresh()"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @description: Dashboard revenue drilldown section
 * @last-modified: 2026-07-16T00:00:00.000Z
 * @last-fix: [2026-07-16] Hide hourly card on multi-day; remove Most Profitable Hour
 *   Prior: [2026-07-02] ADR-013 read-cache metadata
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: dashboard-bundle revenue slice (via useDailyOpsRevenueBreakdown)
 * @imports-data-from: composables/useDailyOpsRevenueBreakdown.ts
 */

import type {
  DailyOpsPeriodId,
  DailyOpsProfitByIntervalDto,
} from '~/types/daily-ops-dashboard'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'

const props = defineProps<{
  period: string
}>()

const EMPTY_PROFIT_BY_INTERVAL: DailyOpsProfitByIntervalDto = {
  estimatesNote: 'No interval breakdown for this period yet.',
  dates: [],
  cells: [],
}

const { dashboardQuery, anchor } = useDailyOpsDashboardRoute()
const locationId = computed(() => dashboardQuery.value.location ?? null)
const { revenue, pending, refresh } = useDailyOpsRevenueBreakdown()

const showHourlyRevenueCard = computed(() => {
  const range = resolveDailyOpsPeriod(props.period as DailyOpsPeriodId, anchor.value ?? undefined)
  return range.startDate === range.endDate
})

const profitByInterval = computed(
  (): DailyOpsProfitByIntervalDto => revenue.value?.profitByInterval ?? EMPTY_PROFIT_BY_INTERVAL,
)
</script>
