<template>
  <div :class="compact ? 'space-y-2 border-t border-gray-100 pt-4' : 'space-y-3'">
    <div class="flex flex-wrap items-center gap-2">
      <h3 v-if="title" class="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {{ title }}
        <span v-if="weekKey" class="font-normal normal-case text-gray-400">({{ weekKey }})</span>
      </h3>
      <span
        v-if="weekSummary"
        class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
        :class="weatherWeekCharacterClass(weekSummary.character)"
      >
        <UIcon :name="weekSummary.icon" class="size-3.5 shrink-0" />
        {{ weekSummary.label }}
      </span>
    </div>

    <div class="flex justify-between gap-1">
      <div
        v-for="day in weather.daily"
        :key="day.date"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-0.5 py-1"
        :title="`${day.date}: ${weatherCodeToLabel(day.weatherCode)}`"
      >
        <UIcon
          :name="weatherCodeToLucideIcon(day.weatherCode)"
          class="size-5 shrink-0"
          :class="iconToneClass(day)"
        />
        <span class="text-[10px] leading-none text-gray-400">{{ formatWeatherDayShort(day.date) }}</span>
      </div>
    </div>

    <p class="text-xs text-gray-600">{{ formatWeatherStats(weather) }}</p>

    <table v-if="showTable" class="w-full text-xs">
      <thead>
        <tr class="text-left text-gray-500">
          <th class="py-1">Day</th>
          <th class="w-8" />
          <th>Min</th>
          <th>Max</th>
          <th>Rain</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="day in weather.daily" :key="`${day.date}-row`" class="border-t border-gray-100">
          <td class="py-1">{{ formatDateWithDayName(day.date) }}</td>
          <td>
            <UIcon
              :name="weatherCodeToLucideIcon(day.weatherCode)"
              class="size-4"
              :class="iconToneClass(day)"
            />
          </td>
          <td>{{ day.tempMinC ?? '—' }}°</td>
          <td>{{ day.tempMaxC ?? '—' }}°</td>
          <td>{{ day.precipMm ?? '—' }} mm</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { WeatherDailyObservation, WeatherRangePayload } from '~/types/weather'
import {
  classifyWeatherWeek,
  formatWeatherDayShort,
  formatWeatherStats,
  weatherCodeToLabel,
  weatherCodeToLucideIcon,
  weatherWeekCharacterClass,
} from '~/utils/dailyOpsWeatherDisplay'

const props = defineProps<{
  weather: WeatherRangePayload
  title?: string
  weekKey?: string
  showTable?: boolean
  compact?: boolean
}>()

const weekSummary = computed(() => classifyWeatherWeek(props.weather))

function iconToneClass(day: WeatherDailyObservation): string {
  const code = day.weatherCode
  if (code != null && code >= 95) return 'text-violet-500'
  if ((day.precipMm ?? 0) >= 1 || (code != null && code >= 61)) return 'text-sky-500'
  if (code === 0) return 'text-amber-500'
  return 'text-gray-400'
}

function formatDateWithDayName(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' })
  return `${dayName} ${date}`
}
</script>
