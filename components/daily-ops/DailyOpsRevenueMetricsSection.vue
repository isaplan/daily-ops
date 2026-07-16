<template>
  <div v-if="pending && !revenue" class="space-y-6">
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
      :period="periodAsId"
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
 * @last-modified: 2026-07-16T12:00:00.000Z
 * @last-fix: [2026-07-16] Show daypart P&L whenever revenue is present (week/month/year too)
 *   Prior: [2026-07-16] Consume parent bundle props — no second metrics instance
 * @adr-ref: ADR-004, ADR-010, ADR-013
 * @data-source: read-cache
 * @read-cache-json: dashboard-bundle revenue slice
 * @imports-data-from: components/daily-ops/DailyOpsHomeDashboard.vue
 */

import type {
  DailyOpsPeriodId,
  DailyOpsProfitByIntervalDto,
  DailyOpsRevenueBreakdownDto,
} from '~/types/daily-ops-dashboard'
import { resolveDailyOpsPeriod } from '~/utils/dailyOpsPeriod'

const props = defineProps<{
  period: string
  revenue: DailyOpsRevenueBreakdownDto | null
  pending: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const EMPTY_PROFIT_BY_INTERVAL: DailyOpsProfitByIntervalDto = {
  estimatesNote: 'No interval breakdown for this period yet.',
  dates: [],
  cells: [],
}

const { dashboardQuery, anchor } = useDailyOpsDashboardRoute()
const locationId = computed(() => dashboardQuery.value.location ?? null)
const periodAsId = computed(() => props.period as DailyOpsPeriodId)

const showHourlyRevenueCard = computed(() => {
  const range = resolveDailyOpsPeriod(periodAsId.value, anchor.value ?? undefined)
  return range.startDate === range.endDate
})

const profitByInterval = computed(
  (): DailyOpsProfitByIntervalDto => props.revenue?.profitByInterval ?? EMPTY_PROFIT_BY_INTERVAL,
)

function refresh() {
  emit('refresh')
}
</script>
