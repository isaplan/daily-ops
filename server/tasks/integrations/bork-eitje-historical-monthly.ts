/**
 * Nitro scheduled task: Bork + Eitje **historical-data-31d** (1st of month, 06:30 Amsterdam).
 * Deep monthly lookback — same pipeline: raw sync → aggregation → snapshot + JSON materialization.
 *
 * @registry-id: taskIntegrationsBorkEitjeHistoricalMonthly
 * @last-modified: 2026-06-24T00:00:00.000Z
 * @last-fix: [2026-06-24] Monthly 31d historical with sync snapshot/JSON pipeline
 * @exports-to: nuxt.config.ts → nitro.scheduledTasks
 */

console.log('[integrations/bork-eitje-historical-monthly.ts] Module loaded - Nitro startup')

import { getDb } from '../../utils/db'
import { runIntegrationCronJob } from '../../services/integrationCronRunner'

const PAUSE_MS = 30_000
const BORK_HISTORICAL_31D = 'historical-data-31d'
const EITJE_HISTORICAL_31D = 'historical-data-31d'

const pause = async () => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, PAUSE_MS)
  })
}

export default defineTask({
  meta: {
    name: 'integrations:bork-eitje-historical-monthly',
    description: 'Monthly 1st 06:30: Bork + Eitje 31d historical through yesterday (snapshot + JSON tail)',
  },
  async run () {
    console.log('[integrations:bork-eitje-historical-monthly] TRIGGERED AT', new Date().toISOString())
    try {
      const db = await getDb()

      const borkHistorical = await runIntegrationCronJob(db, 'bork', BORK_HISTORICAL_31D)
      console.log('[integrations:bork-eitje-historical-monthly] Bork 31d done, waiting...')
      await pause()

      const eitjeHistorical = await runIntegrationCronJob(db, 'eitje', EITJE_HISTORICAL_31D)
      console.log('[integrations:bork-eitje-historical-monthly] Eitje 31d done')

      const ok = borkHistorical.syncResult.ok && eitjeHistorical.syncResult.ok

      return {
        result: {
          ok,
          borkHistorical: borkHistorical.syncResult,
          eitjeHistorical: eitjeHistorical.syncResult,
        },
      }
    } catch (e) {
      console.error('[integrations:bork-eitje-historical-monthly] ERROR:', e)
      throw e
    }
  },
})
