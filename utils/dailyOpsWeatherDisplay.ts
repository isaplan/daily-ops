/**
 * @description: WMO weather-code icons + weekly weather character labels (Open-Meteo)
 * @adr-ref: ADR-015
 */

import type { WeatherRangePayload } from '~/types/weather'

export type WeatherWeekCharacter = 'sunny' | 'rainy' | 'cloudy' | 'mixed' | 'stormy'

export type WeatherWeekSummary = {
  character: WeatherWeekCharacter
  label: string
  icon: string
}

const STORM_CODES = new Set([95, 96, 99])

/** Open-Meteo WMO weather code → Lucide icon (Nuxt UI). */
export function weatherCodeToLucideIcon(code: number | null): string {
  if (code == null) return 'i-lucide-cloud'
  if (code === 0) return 'i-lucide-sun'
  if (code <= 3) return 'i-lucide-cloud-sun'
  if (code === 45 || code === 48) return 'i-lucide-cloud-fog'
  if (code >= 51 && code <= 57) return 'i-lucide-cloud-drizzle'
  if (code >= 61 && code <= 67) return 'i-lucide-cloud-rain'
  if (code >= 71 && code <= 77) return 'i-lucide-snowflake'
  if (code >= 80 && code <= 82) return 'i-lucide-cloud-rain'
  if (code >= 85 && code <= 86) return 'i-lucide-snowflake'
  if (code >= 95) return 'i-lucide-cloud-lightning'
  return 'i-lucide-cloud'
}

export function weatherCodeToLabel(code: number | null): string {
  if (code == null) return 'Unknown'
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly cloudy'
  if (code === 45 || code === 48) return 'Fog'
  if (code >= 51 && code <= 57) return 'Drizzle'
  if (code >= 61 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Showers'
  if (code >= 85 && code <= 86) return 'Snow showers'
  if (code >= 95) return 'Thunderstorm'
  return 'Cloudy'
}

export function classifyWeatherWeek(weather: WeatherRangePayload): WeatherWeekSummary | null {
  if (!weather.daily.length) return null

  const precip = weather.summary.totalPrecipMm ?? 0
  const sun = weather.summary.totalSunHours ?? 0
  const rainyDays = weather.daily.filter((d) => (d.precipMm ?? 0) >= 1).length
  const stormDays = weather.daily.filter((d) => d.weatherCode != null && STORM_CODES.has(d.weatherCode)).length

  if (stormDays >= 1) {
    return { character: 'stormy', label: 'Stormy week', icon: 'i-lucide-cloud-lightning' }
  }
  if (precip >= 20 || rainyDays >= 4) {
    return { character: 'rainy', label: 'Rainy week', icon: 'i-lucide-cloud-rain' }
  }
  if (sun >= 40 && precip < 5 && rainyDays <= 1) {
    return { character: 'sunny', label: 'Sunny week', icon: 'i-lucide-sun' }
  }
  if (sun < 25 && precip < 10) {
    return { character: 'cloudy', label: 'Cloudy week', icon: 'i-lucide-cloud' }
  }
  return { character: 'mixed', label: 'Mixed week', icon: 'i-lucide-cloud-sun' }
}

export function weatherWeekCharacterClass(character: WeatherWeekCharacter): string {
  if (character === 'sunny') return 'bg-amber-50 text-amber-800 border-amber-200'
  if (character === 'rainy') return 'bg-sky-50 text-sky-800 border-sky-200'
  if (character === 'stormy') return 'bg-violet-50 text-violet-800 border-violet-200'
  if (character === 'cloudy') return 'bg-gray-50 text-gray-700 border-gray-200'
  return 'bg-orange-50 text-orange-800 border-orange-200'
}

export function formatWeatherDayShort(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'short' })
}

export function formatWeatherStats(weather: WeatherRangePayload): string {
  const { summary } = weather
  return `Avg ${summary.avgTempMinC ?? '—'}° – ${summary.avgTempMaxC ?? '—'}°C · ${summary.totalPrecipMm ?? '—'} mm rain · ${summary.totalSunHours ?? '—'} h sun`
}
