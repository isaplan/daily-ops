<template>
  <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold uppercase text-gray-500">Weather (Den Haag)</h2>

    <div v-if="weather.daily.length" class="space-y-4 text-sm">
      <WeeklyReportsWeatherWeekBlock
        title="This week"
        :weather="weather"
        :week-key="weekKey"
        show-table
      />

      <WeeklyReportsWeatherWeekBlock
        v-if="previousWeekWeather?.daily.length"
        title="Last week"
        :weather="previousWeekWeather"
        :week-key="previousWeekKey"
        compact
      />
    </div>

    <p v-else class="text-sm text-gray-500">No weather data for this week yet. Run weather backfill.</p>
  </section>
</template>

<script setup lang="ts">
import type { WeatherRangePayload } from '~/types/weather'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'
import { getIsoWeekFromYmd } from '~/utils/dailyOpsPeriodBreakdownChart'

const props = defineProps<{
  weather: WeatherRangePayload
  previousWeekWeather?: WeatherRangePayload | null
  weekKey?: string
}>()

const previousWeekKey = computed(() => {
  const start = props.weather.daily[0]?.date
  if (!start) return undefined
  return getIsoWeekFromYmd(addCalendarDaysYmd(start, -7))
})
</script>
