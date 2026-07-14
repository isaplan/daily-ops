/**
 * @registry-id: dailyOpsWeatherConstants
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Weather collection name + The Hague coordinates (Open-Meteo)
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsWeather/*
 */

export const WEATHER_OBSERVATIONS_COLLECTION = 'weather_observations'

/** Den Haag city centre — all venues share this weather. */
export const THE_HAGUE_COORDS = {
  latitude: 52.0705,
  longitude: 4.3007,
  label: 'Den Haag',
} as const

export const WEATHER_BACKFILL_START = '2024-01-01'
