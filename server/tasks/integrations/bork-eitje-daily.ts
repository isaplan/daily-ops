/**
 * Nitro scheduled task: Bork then Eitje `daily-data` (same order and 30s gap as daily-ops-sync.yml).
 *
 * @registry-id: taskIntegrationsBorkEitjeDaily
 * @last-modified: 2026-04-24T12:00:00.000Z
 * @last-fix: [2026-04-24] Nitro cron slots aligned with legacy GitHub Actions UTC schedule
 * @exports-to: nuxt.config.ts → nitro.scheduledTasks
 */

console.log('[integrations/bork-eitje-daily.ts] Module loaded - this should print on Nitro startup')

import { getDb } from '../../utils/db'
import { runIntegrationCronJob } from '../../services/integrationCronRunner'

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
      return {
        result: {
          ok: bork.syncResult.ok && eitje.syncResult.ok,
          bork: bork.syncResult,
          eitje: eitje.syncResult,
        },
      }
    } catch (e) {
      console.error('[integrations:bork-eitje-daily] ERROR:', e)
      throw e
    }
  },
})
