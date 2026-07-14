<template>
  <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold uppercase text-gray-500">Weather (Den Haag)</h2>
    <div v-if="weather.daily.length" class="space-y-2 text-sm">
      <p>
        Avg {{ weather.summary.avgTempMinC ?? '—' }}° – {{ weather.summary.avgTempMaxC ?? '—' }}°C ·
        {{ weather.summary.totalPrecipMm ?? '—' }} mm rain ·
        {{ weather.summary.totalSunHours ?? '—' }} h sun
      </p>
      <table class="w-full text-xs">
        <thead>
          <tr class="text-left text-gray-500">
            <th class="py-1">Day</th>
            <th>Min</th>
            <th>Max</th>
            <th>Rain</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="day in weather.daily" :key="day.date" class="border-t border-gray-100">
            <td class="py-1">{{ day.date }}</td>
            <td>{{ day.tempMinC ?? '—' }}°</td>
            <td>{{ day.tempMaxC ?? '—' }}°</td>
            <td>{{ day.precipMm ?? '—' }} mm</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="text-sm text-gray-500">No weather data for this week yet. Run weather backfill.</p>
  </section>
</template>

<script setup lang="ts">
import type { WeatherRangePayload } from '~/types/weather'

defineProps<{ weather: WeatherRangePayload }>()
</script>
