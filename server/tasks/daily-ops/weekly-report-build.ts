/**
 * @registry-id: taskDailyOpsWeeklyReportBuild
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Monday 01:15 — build sealed weekly_reports for last 5 weeks × 3 venues
 * @last-fix: [2026-07-14] Initial weekly report document build task
 * @adr-ref: ADR-015
 * @exports-to: nuxt.config.ts → nitro.scheduledTasks
 */

import { getDb } from '../../utils/db'
import { VENUE_STRIP_LOCATIONS } from '../../utils/venueStrip/constants'
import { upsertWeeklyReportDocument } from '../../utils/weeklyReportDocument/upsertWeeklyReportDocument'
import { previousWeekRange, resolveWeeklyRange } from '../../utils/dailyOpsWeeklyReport/weekRange'

export default defineTask({
  meta: {
    name: 'daily-ops:weekly-report-build',
    description: 'Build/update weekly_reports documents for recent weeks (per venue)',
  },
  async run() {
    const db = await getDb()
    const weeks: string[] = []
    let range = resolveWeeklyRange({ period: 'last-week' })
    weeks.push(range.weekKey)
    for (let i = 0; i < 4; i += 1) {
      range = previousWeekRange(range)
      weeks.push(range.weekKey)
    }

    let written = 0
    for (const weekKey of weeks) {
      for (const venue of VENUE_STRIP_LOCATIONS) {
        await upsertWeeklyReportDocument(db, weekKey, venue.locationId)
        written += 1
      }
    }

    return { result: { ok: true, written, weeks } }
  },
})
