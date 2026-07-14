/**
 * @registry-id: dailyOpsWeatherGetRange
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Query weather observations for a date range + aggregate summary
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/weeklyReportDocument/buildWeeklyReportDocument.ts
 */

import type { Db } from 'mongodb'
import type { WeatherDailyObservation, WeatherRangePayload } from '~/types/weather'
import { WEATHER_OBSERVATIONS_COLLECTION } from './constants'

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n != null && Number.isFinite(n))
  if (!valid.length) return null
  return Math.round((valid.reduce((s, n) => s + n, 0) / valid.length) * 10) / 10
}

function sum(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n != null && Number.isFinite(n))
  if (!valid.length) return null
  return Math.round(valid.reduce((s, n) => s + n, 0) * 10) / 10
}

function summarize(daily: WeatherDailyObservation[]): WeatherRangePayload['summary'] {
  return {
    avgTempMinC: avg(daily.map((d) => d.tempMinC)),
    avgTempMaxC: avg(daily.map((d) => d.tempMaxC)),
    totalPrecipMm: sum(daily.map((d) => d.precipMm)),
    avgWindKmh: avg(daily.map((d) => d.windKmh)),
    totalSunHours: sum(daily.map((d) => d.sunHours)),
  }
}

export async function getWeatherForRange(db: Db, startDate: string, endDate: string): Promise<WeatherRangePayload> {
  const docs = await db
    .collection(WEATHER_OBSERVATIONS_COLLECTION)
    .find({ date: { $gte: startDate, $lte: endDate } })
    .sort({ date: 1 })
    .toArray()

  const daily: WeatherDailyObservation[] = docs.map((doc) => ({
    date: String(doc.date),
    tempMinC: doc.tempMinC ?? null,
    tempMaxC: doc.tempMaxC ?? null,
    precipMm: doc.precipMm ?? null,
    windKmh: doc.windKmh ?? null,
    sunHours: doc.sunHours ?? null,
    weatherCode: doc.weatherCode ?? null,
    source: 'open-meteo' as const,
  }))

  return { daily, summary: summarize(daily) }
}
