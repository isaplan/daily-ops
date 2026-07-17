/**
 * @registry-id: taskDailyOpsMonthlyReportBuild
 * @created: 2026-07-17T00:00:00.000Z
 * @last-modified: 2026-07-17T00:00:00.000Z
 * @description: 1st of month 01:15 — build sealed monthly_reports for last 3 months × 3 venues
 * @last-fix: [2026-07-17] Initial monthly report document build task
 * @adr-ref: ADR-015
 * @exports-to: nuxt.config.ts → nitro.scheduledTasks
 */

import { getDb } from '../../utils/db'
import { VENUE_STRIP_LOCATIONS } from '../../utils/venueStrip/constants'
import { upsertMonthlyReportDocument } from '../../utils/monthlyReportDocument/upsertMonthlyReportDocument'
import { previousMonthRange, resolveMonthlyRange } from '../../utils/dailyOpsMonthlyReport/monthRange'

export default defineTask({
  meta: {
    name: 'daily-ops:monthly-report-build',
    description: 'Build/update monthly_reports documents for recent months (per venue)',
  },
  async run() {
    const db = await getDb()
    const months: string[] = []
    let range = resolveMonthlyRange({ period: 'last-month' })
    months.push(range.monthKey)
    for (let i = 0; i < 2; i += 1) {
      range = previousMonthRange(range)
      months.push(range.monthKey)
    }

    let written = 0
    for (const monthKey of months) {
      for (const venue of VENUE_STRIP_LOCATIONS) {
        await upsertMonthlyReportDocument(db, monthKey, venue.locationId)
        written += 1
      }
    }

    return { result: { ok: true, written, months } }
  },
})
