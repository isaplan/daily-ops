/**
 * @registry-id: integrationCronRunner
 * @created: 2026-04-24T12:00:00.000Z
 * @last-modified: 2026-04-24T12:00:00.000Z
 * @description: Shared Bork/Eitje run-now sync + integration_cron_jobs persistence (HTTP, Nitro tasks, catch-up)
 * @last-fix: [2026-04-24] Extracted from v2 cron.post handlers for Nitro schedule + startup catch-up
 *
 * @exports-to:
 * ✓ server/api/bork/v2/cron.post.ts
 * ✓ server/api/eitje/v2/cron.post.ts
 * ✓ server/tasks/integrations/bork-eitje-daily.ts
 * ✓ server/plugins/integration-sync-catchup.ts
 */

import type { Db } from 'mongodb'
import { executeBorkJob, type BorkSyncJobResult } from './borkSyncService'
import { executeEitjeJob, type EitjeSyncJobResult } from './eitjeSyncService'

export type IntegrationCronRunResult =
  | { source: 'bork'; syncResult: BorkSyncJobResult }
  | { source: 'eitje'; syncResult: EitjeSyncJobResult }

export async function runIntegrationCronJob(
  db: Db,
  source: 'bork' | 'eitje',
  jobType: string,
): Promise<IntegrationCronRunResult> {
  const runStarted = new Date()
  const query = { source, jobType }

  await db.collection('integration_cron_jobs').updateOne(
    query,
    {
      $set: {
        source,
        jobType,
        lastRun: runStarted.toISOString(),
        lastRunUTC: runStarted.toISOString(),
        updatedAt: runStarted,
      },
      $setOnInsert: { createdAt: runStarted, isActive: true },
    },
    { upsert: true },
  )

  const syncResult =
    source === 'bork'
      ? await executeBorkJob(db, jobType)
      : await executeEitjeJob(db, jobType)

  const syncedAt = new Date()
  await db.collection('integration_cron_jobs').updateOne(query, {
    $set: {
      lastSyncAt: syncedAt.toISOString(),
      lastSyncOk: syncResult.ok,
      lastSyncMessage: syncResult.message,
      lastSyncDetail: syncResult,
      updatedAt: syncedAt,
    },
  })

  return source === 'bork'
    ? { source: 'bork', syncResult }
    : { source: 'eitje', syncResult }
}

export async function loadIntegrationCronRow(db: Db, source: 'bork' | 'eitje', jobType: string) {
  return db.collection('integration_cron_jobs').findOne({ source, jobType })
}

export function isIntegrationCronStale(
  row: { lastSyncAt?: unknown; lastSyncOk?: unknown } | null,
  staleMs: number,
): boolean {
  if (!row) return true
  if (row.lastSyncOk === false) return true
  const raw = row.lastSyncAt
  const t = typeof raw === 'string' ? Date.parse(raw) : NaN
  if (!Number.isFinite(t)) return true
  return Date.now() - t > staleMs
}
