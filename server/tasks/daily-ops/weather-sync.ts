/**
 * @registry-id: taskDailyOpsWeatherSync
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Daily 06:15 — sync yesterday actuals + 7-day forecast from Open-Meteo (The Hague)
 * @last-fix: [2026-07-14] Initial weather sync task
 * @adr-ref: ADR-015
 * @exports-to: nuxt.config.ts → nitro.scheduledTasks
 */

import { getDb } from '../../utils/db'
import { backfillWeatherHistory } from '../../utils/dailyOpsWeather/backfillWeatherHistory'
import { addCalendarDaysYmd, calendarYmdInAmsterdam } from '~/utils/dailyOpsBusinessDate'

export default defineTask({
  meta: {
    name: 'daily-ops:weather-sync',
    description: 'Sync The Hague daily weather (yesterday + 7-day forecast) from Open-Meteo',
  },
  async run() {
    const db = await getDb()
    const today = calendarYmdInAmsterdam(new Date())
    const yesterday = addCalendarDaysYmd(today, -1)
    const result = await backfillWeatherHistory(db, { startDate: yesterday, endDate: today })
    return { result: { ok: true, written: result.written } }
  },
})
