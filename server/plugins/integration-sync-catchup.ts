/**
 * On server ready: if Bork/Eitje `daily-data` watermark is stale, run one sync (deploy / downtime gap).
 * Enable in production by default; disable with INTEGRATION_SYNC_CATCHUP_ON_START=0.
 */
import { getDb } from '../utils/db'
import {
  isIntegrationCronStale,
  loadIntegrationCronRow,
  runIntegrationCronJob,
} from '../services/integrationCronRunner'

const JOB_TYPE = 'daily-data'
const PAUSE_MS = 30_000

function catchupEnabled(): boolean {
  if (process.env.INTEGRATION_SYNC_CATCHUP_ON_START === '0') return false
  if (process.env.INTEGRATION_SYNC_CATCHUP_ON_START === '1') return true
  return process.env.NODE_ENV === 'production'
}

function staleMs(): number {
  const raw = process.env.INTEGRATION_SYNC_STALE_MS
  if (raw) {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  return 9 * 60 * 60 * 1000
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('ready', () => {
    void (async () => {
      if (!catchupEnabled()) return
      const ms = staleMs()
      try {
        const db = await getDb()
        const borkRow = await loadIntegrationCronRow(db, 'bork', JOB_TYPE)
        const eitjeRow = await loadIntegrationCronRow(db, 'eitje', JOB_TYPE)
        const needBork = isIntegrationCronStale(borkRow, ms)
        const needEitje = isIntegrationCronStale(eitjeRow, ms)
        if (!needBork && !needEitje) {
          nitroApp.logger?.info('[integrations-catchup] skip; lastSync within stale window')
          return
        }
        nitroApp.logger?.info(
          `[integrations-catchup] running stale jobs bork=${needBork} eitje=${needEitje} staleMs=${ms}`,
        )
        if (needBork) await runIntegrationCronJob(db, 'bork', JOB_TYPE)
        if (needBork && needEitje) {
          await new Promise<void>((r) => {
            setTimeout(r, PAUSE_MS)
          })
        }
        if (needEitje) await runIntegrationCronJob(db, 'eitje', JOB_TYPE)
        nitroApp.logger?.info('[integrations-catchup] finished')
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        nitroApp.logger?.error(`[integrations-catchup] failed: ${msg}`)
      }
    })()
  })
})
