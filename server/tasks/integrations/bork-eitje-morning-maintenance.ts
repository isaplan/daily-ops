/**
 * Nitro scheduled task: Bork + Eitje **master-data** then **historical-data-7d** (06:00 Amsterdam).
 * Pipeline tail: each job sync → V2 aggregation → await snapshot + JSON materialization (`forceReopenSealed`).
 *
 * @registry-id: taskIntegrationsBorkEitjeMorningMaintenance
 * @last-modified: 2026-06-24T00:00:00.000Z
 * @last-fix: [2026-06-24] historical-data-7d + sync snapshot/JSON pipeline on master + historical
 * @exports-to: nuxt.config.ts → nitro.scheduledTasks
 */

console.log('[integrations/bork-eitje-morning-maintenance.ts] Module loaded - Nitro startup')

import { getDb } from '../../utils/db'
import { runIntegrationCronJob } from '../../services/integrationCronRunner'

const PAUSE_MS = 30_000
const BORK_HISTORICAL_7D = 'historical-data-7d'
const EITJE_HISTORICAL_7D = 'historical-data-7d'

const pause = async () => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, PAUSE_MS)
  })
}

export default defineTask({
  meta: {
    name: 'integrations:bork-eitje-morning-maintenance',
    description:
      '06:00: Bork master + Eitje master, then Bork/Eitje 7d historical (through yesterday). Each step materializes snapshots + JSON.',
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

      const borkHistorical = await runIntegrationCronJob(db, 'bork', BORK_HISTORICAL_7D)
      console.log('[integrations:bork-eitje-morning-maintenance] Bork historical 7d done, waiting...')
      await pause()

      const eitjeHistorical = await runIntegrationCronJob(db, 'eitje', EITJE_HISTORICAL_7D)
      console.log('[integrations:bork-eitje-morning-maintenance] Eitje historical 7d done')

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
