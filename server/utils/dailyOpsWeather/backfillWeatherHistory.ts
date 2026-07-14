/**
 * @registry-id: dailyOpsWeatherBackfill
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Backfill historical weather from Open-Meteo (chunked by year)
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ scripts/backfill-weather-history.ts
 * ✓ server/tasks/daily-ops/weather-sync.ts
 */

import type { Db } from 'mongodb'
import { addCalendarDaysYmd, calendarYmdInAmsterdam } from '~/utils/dailyOpsBusinessDate'
import { WEATHER_BACKFILL_START } from './constants'
import { fetchForecastWeather, fetchHistoricalWeather } from './fetchOpenMeteo'
import { ensureWeatherIndex, upsertWeatherObservations } from './upsertWeatherObservations'

function yearChunks(startDate: string, endDate: string): Array<{ start: string; end: string }> {
  const chunks: Array<{ start: string; end: string }> = []
  let year = Number(startDate.slice(0, 4))
  const endYear = Number(endDate.slice(0, 4))
  while (year <= endYear) {
    const start = year === Number(startDate.slice(0, 4)) ? startDate : `${year}-01-01`
    const yearEnd = `${year}-12-31`
    const end = yearEnd < endDate ? yearEnd : endDate
    chunks.push({ start, end })
    year += 1
  }
  return chunks
}

export async function backfillWeatherHistory(
  db: Db,
  opts?: { startDate?: string; endDate?: string },
): Promise<{ written: number }> {
  await ensureWeatherIndex(db)
  const startDate = opts?.startDate ?? WEATHER_BACKFILL_START
  const endDate = opts?.endDate ?? calendarYmdInAmsterdam(new Date())
  const today = calendarYmdInAmsterdam(new Date())
  const forecastStart = addCalendarDaysYmd(today, 1)
  const forecastEnd = addCalendarDaysYmd(today, 7)

  let written = 0
  for (const chunk of yearChunks(startDate, endDate < today ? endDate : today)) {
    const rows = await fetchHistoricalWeather(chunk.start, chunk.end)
    written += await upsertWeatherObservations(db, rows)
  }

  if (forecastStart <= forecastEnd) {
    const forecast = await fetchForecastWeather(forecastStart, forecastEnd)
    written += await upsertWeatherObservations(db, forecast)
  }

  return { written }
}
