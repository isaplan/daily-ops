/**
 * @registry-id: dailyOpsWeatherUpsert
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Upsert daily weather observations by date
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsWeather/backfillWeatherHistory.ts
 * ✓ server/tasks/daily-ops/weather-sync.ts
 */

import type { Db } from 'mongodb'
import type { WeatherDailyObservation } from '~/types/weather'
import { WEATHER_OBSERVATIONS_COLLECTION } from './constants'

export async function upsertWeatherObservations(db: Db, rows: WeatherDailyObservation[]): Promise<number> {
  if (!rows.length) return 0
  const coll = db.collection(WEATHER_OBSERVATIONS_COLLECTION)
  const ops = rows.map((row) => ({
    updateOne: {
      filter: { date: row.date },
      update: { $set: { ...row, updatedAt: new Date().toISOString() } },
      upsert: true,
    },
  }))
  const result = await coll.bulkWrite(ops, { ordered: false })
  return result.upsertedCount + result.modifiedCount
}

export async function ensureWeatherIndex(db: Db): Promise<void> {
  await db.collection(WEATHER_OBSERVATIONS_COLLECTION).createIndex({ date: 1 }, { unique: true, name: 'date_unique' })
}
