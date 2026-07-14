/**
 * @registry-id: weatherTypes
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Daily weather observation types (The Hague, Open-Meteo)
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsWeather/*
 * ✓ server/utils/weeklyReportDocument/*
 * ✓ types/weeklyReportDocument.ts
 */

export type WeatherDailyObservation = {
  date: string
  tempMinC: number | null
  tempMaxC: number | null
  precipMm: number | null
  windKmh: number | null
  sunHours: number | null
  weatherCode: number | null
  source: 'open-meteo'
}

export type WeatherRangeSummary = {
  avgTempMinC: number | null
  avgTempMaxC: number | null
  totalPrecipMm: number | null
  avgWindKmh: number | null
  totalSunHours: number | null
}

export type WeatherRangePayload = {
  daily: WeatherDailyObservation[]
  summary: WeatherRangeSummary
}
