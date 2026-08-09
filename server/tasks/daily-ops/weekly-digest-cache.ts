/**
 * @registry-id: taskDailyOpsWeeklyDigestCache
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-08-09T17:30:00.000Z
 * @description: Monday 01:00 — ensure period-cache week cascade for last ISO week (Phase 7)
 * @last-fix: [2026-08-09] Phase 7 — cascade period weeks; no weekly-digest read-cache write
 * @adr-ref: PERIOD_CACHE_ADR L2
 * @exports-to: nuxt.config.ts → nitro.scheduledTasks
 */

import { getDb } from '../../utils/db'
import { cascadePeriodRange } from '../../utils/dailyOpsPeriodCache/cascadePeriod'
import { resolveWeeklyRange } from '../../utils/dailyOpsWeeklyReport/weekRange'

export default defineTask({
  meta: {
    name: 'daily-ops:weekly-digest-cache',
    description: 'Cascade period-cache week nodes for last completed ISO week (Phase 7)',
  },
  async run () {
    const db = await getDb()
    const range = resolveWeeklyRange({ period: 'last-week' })
    const result = await cascadePeriodRange(db, range.startDate, range.endDate)
    return {
      result: {
        ok: true,
        weekKey: range.weekKey,
        cascaded: result,
      },
    }
  },
})
