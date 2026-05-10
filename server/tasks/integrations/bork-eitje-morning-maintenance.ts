/**
 * Nitro scheduled task: Bork + Eitje **master-data** then **historical-data** (06:00 Amsterdam).
 * Master runs first (reference + yesterday tickets), then rolling historical backfill (never includes today).
 *
 * @registry-id: taskIntegrationsBorkEitjeMorningMaintenance
 * @last-modified: 2026-05-11T12:00:00.000Z
 * @last-fix: [2026-05-11] Single 06:00 slot: Bork master → Eitje master → Bork historical → Eitje historical
 * @exports-to: nuxt.config.ts → nitro.scheduledTasks
 */

console.log('[integrations/bork-eitje-morning-maintenance.ts] Module loaded - Nitro startup')

import { getDb } from '../../utils/db'
import { runIntegrationCronJob } from '../../services/integrationCronRunner'

const PAUSE_MS = 30_000

const pause = async () => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, PAUSE_MS)
  })
}

export default defineTask({
  meta: {
    name: 'integrations:bork-eitje-morning-maintenance',
    description:
      '06:00: Bork master (yesterday tickets) + Eitje master (env/teams/users), then Bork 30d + Eitje historical labor (through yesterday only)',
  },
  async run () {
    console.log('[integrations:bork-eitje-morning-maintenance] TRIGGERED AT', new Date().toISOString())
    try {
      const db = await getDb()
      console.log('[integrations:bork-eitje-morning-maintenance] Got database connection')

      const borkMaster = await runIntegrationCronJob(db, 'bork', 'master-data')
      console.log('[integrations:bork-eitje-morning-maintenance] Bork master-data done, waiting...')
      await pause()

      const eitjeMaster = await runIntegrationCronJob(db, 'eitje', 'master-data')
      console.log('[integrations:bork-eitje-morning-maintenance] Eitje master-data done, waiting...')
      await pause()

      const borkHistorical = await runIntegrationCronJob(db, 'bork', 'historical-data')
      console.log('[integrations:bork-eitje-morning-maintenance] Bork historical-data done, waiting...')
      await pause()

      const eitjeHistorical = await runIntegrationCronJob(db, 'eitje', 'historical-data')
      console.log('[integrations:bork-eitje-morning-maintenance] Eitje historical-data done')

      const ok =
        borkMaster.syncResult.ok &&
        eitjeMaster.syncResult.ok &&
        borkHistorical.syncResult.ok &&
        eitjeHistorical.syncResult.ok

      return {
        result: {
          ok,
          borkMaster: borkMaster.syncResult,
          eitjeMaster: eitjeMaster.syncResult,
          borkHistorical: borkHistorical.syncResult,
          eitjeHistorical: eitjeHistorical.syncResult,
        },
      }
    } catch (e) {
      console.error('[integrations:bork-eitje-morning-maintenance] ERROR:', e)
      throw e
    }
  },
})
