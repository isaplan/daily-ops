/**
 * @registry-id: taskDailyOpsWeeklyDigestCache
 * @created: 2026-07-09T00:00:00.000Z
 * @last-modified: 2026-07-09T00:00:00.000Z
 * @description: Monday 01:00 — prebuild weekly-digest read-cache from daily snapshots
 * @last-fix: [2026-07-09] Initial weekly digest cache task
 * @adr-ref: ADR-004, ADR-013
 * @exports-to: nuxt.config.ts → nitro.scheduledTasks
 */

import { getDb } from '../../utils/db'
import { aggregateWeeklyReadCache } from '../../utils/dailyOpsSnapshot/aggregateWeeklyReadCache'
import { resolveWeeklyRange } from '../../utils/dailyOpsWeeklyReport/weekRange'

export default defineTask({
  meta: {
    name: 'daily-ops:weekly-digest-cache',
    description: 'Aggregate last completed ISO week into daily_ops_read_cache profile=weekly-digest',
  },
  async run() {
    const db = await getDb()
    const range = resolveWeeklyRange({ period: 'last-week' })
    const result = await aggregateWeeklyReadCache(db, range)
    return { result: { ok: true, weekKey: range.weekKey, written: result.written } }
  },
})
