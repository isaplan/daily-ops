/**
 * @registry-id: dailyOpsWeatherFetchOpenMeteo
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Open-Meteo archive + forecast fetch wrapper for The Hague daily weather
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsWeather/backfillWeatherHistory.ts
 * ✓ server/tasks/daily-ops/weather-sync.ts
 */

import type { WeatherDailyObservation } from '~/types/weather'
import { THE_HAGUE_COORDS } from './constants'

type OpenMeteoDailyResponse = {
  daily?: {
    time?: string[]
    temperature_2m_max?: (number | null)[]
    temperature_2m_min?: (number | null)[]
    precipitation_sum?: (number | null)[]
    wind_speed_10m_max?: (number | null)[]
    sunshine_duration?: (number | null)[]
    weather_code?: (number | null)[]
  }
}

const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'wind_speed_10m_max',
  'sunshine_duration',
  'weather_code',
].join(',')

function round1(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null
  return Math.round(n * 10) / 10
}

function normalizeResponse(data: OpenMeteoDailyResponse): WeatherDailyObservation[] {
  const daily = data.daily
  if (!daily?.time?.length) return []
  const out: WeatherDailyObservation[] = []
  for (let i = 0; i < daily.time.length; i += 1) {
    const date = daily.time[i]
    if (!date) continue
    const sunSec = daily.sunshine_duration?.[i]
    out.push({
      date,
      tempMaxC: round1(daily.temperature_2m_max?.[i]),
      tempMinC: round1(daily.temperature_2m_min?.[i]),
      precipMm: round1(daily.precipitation_sum?.[i]),
      windKmh: round1(daily.wind_speed_10m_max?.[i]),
      sunHours: sunSec != null && Number.isFinite(sunSec) ? round1(sunSec / 3600) : null,
      weatherCode: daily.weather_code?.[i] ?? null,
      source: 'open-meteo',
    })
  }
  return out
}

async function fetchOpenMeteo(baseUrl: string, startDate: string, endDate: string): Promise<WeatherDailyObservation[]> {
  const params = new URLSearchParams({
    latitude: String(THE_HAGUE_COORDS.latitude),
    longitude: String(THE_HAGUE_COORDS.longitude),
    start_date: startDate,
    end_date: endDate,
    daily: DAILY_VARS,
    timezone: 'Europe/Amsterdam',
  })
  const res = await fetch(`${baseUrl}?${params}`)
  if (!res.ok) {
    throw new Error(`Open-Meteo ${res.status}: ${await res.text()}`)
  }
  const json = (await res.json()) as OpenMeteoDailyResponse
  return normalizeResponse(json)
}

export async function fetchHistoricalWeather(startDate: string, endDate: string): Promise<WeatherDailyObservation[]> {
  return fetchOpenMeteo('https://archive-api.open-meteo.com/v1/archive', startDate, endDate)
}

export async function fetchForecastWeather(startDate: string, endDate: string): Promise<WeatherDailyObservation[]> {
  return fetchOpenMeteo('https://api.open-meteo.com/v1/forecast', startDate, endDate)
}
