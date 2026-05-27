/**
 * Nitro scheduled task: Bork then Eitje `daily-data` (same order and 30s gap as daily-ops-sync.yml).
 *
 * @registry-id: taskIntegrationsBorkEitjeDaily
 * @last-modified: 2026-05-27T12:00:00.000Z
 * @last-fix: [2026-05-28] Corrected cron: 01:00, 08:00, 15:00, 18:00, 19:00, 20:00, 21:00, 23:00 (8× daily).
 *   Prior: [2026-05-26] Summer daily slots 01,08,15,17–23,24 Amsterdam (see nuxt.config scheduledTasks)
 * @exports-to: nuxt.config.ts → nitro.scheduledTasks
 */

console.log('[integrations/bork-eitje-daily.ts] Module loaded - this should print on Nitro startup')

import { addCalendarDaysYmd, calendarYmdInAmsterdam } from '~/utils/dailyOpsBusinessDate'
import { getDb } from '../../utils/db'
import { runIntegrationCronJob } from '../../services/integrationCronRunner'
import { rebuildSnapshotsForBusinessDateRange } from '../../utils/dailyOpsSnapshot/triggerSnapshotRebuilds'

const JOB_TYPE = 'daily-data'
const PAUSE_MS = 30_000

export default defineTask({
  meta: {
    name: 'integrations:bork-eitje-daily',
    description: 'Scheduled Bork + Eitje daily-data raw fetch (matches GitHub daily-ops-sync.yml)',
  },
  async run() {
    console.log('[integrations:bork-eitje-daily] SCHEDULED TASK TRIGGERED AT', new Date().toISOString())
    try {
      const db = await getDb()
      console.log('[integrations:bork-eitje-daily] Got database connection')
      const bork = await runIntegrationCronJob(db, 'bork', JOB_TYPE)
      console.log('[integrations:bork-eitje-daily] Bork completed, waiting...')
      await new Promise<void>((resolve) => {
        setTimeout(resolve, PAUSE_MS)
      })
      const eitje = await runIntegrationCronJob(db, 'eitje', JOB_TYPE)
      console.log('[integrations:bork-eitje-daily] Eitje completed')

      const todayYmd = calendarYmdInAmsterdam(new Date())
      const yesterdayYmd = addCalendarDaysYmd(todayYmd, -1)
      const snapshots = await rebuildSnapshotsForBusinessDateRange(db, yesterdayYmd, todayYmd)

      return {
        result: {
          ok: bork.syncResult.ok && eitje.syncResult.ok,
          bork: bork.syncResult,
          eitje: eitje.syncResult,
          snapshots,
        },
      }
    } catch (e) {
      console.error('[integrations:bork-eitje-daily] ERROR:', e)
      throw e
    }
  },
})
