/**
 * @registry-id: opsNotificationDetectorIntegrationSyncFailures
 * @created: 2026-07-11T17:30:00.000Z
 * @last-modified: 2026-07-16T00:00:00.000Z
 * @description: Detect partial or failed Bork/Eitje integration cron syncs
 * @last-fix: [2026-07-16] Stop re-emitting when all failed locations are chronic (retry streak capped)
 *   Prior: [2026-07-15] Surface chronic per-location failures when auto-retry streak cap hit
 *   Prior: [2026-07-11] Initial — lastSyncOk false or per-location ok:false in lastSyncDetail
 * @adr-ref: ADR-004
 *
 * @exports-to:
 * ✓ server/utils/opsNotifications/runOpsNotificationScan.ts
 */

import type { Db } from 'mongodb'
import { buildNotificationItem } from '../notificationItem'
import {
  integrationAutoRetryPaused,
  MAX_INTEGRATION_LOCATION_RETRY_STREAK,
} from '../integrationSyncRetryStreak'
import type { OpsNotificationDto } from '~/types/ops-notifications'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd } from '~/utils/dailyOpsBusinessDate'
import { historicalLookbackDaysForJobType } from '~/utils/integrations/historicalJobTypes'

const WATCHED_JOB_TYPES = new Set([
  'daily-data',
  'historical-data-7d',
  'historical-data-31d',
  'master-data',
])

type BorkLocationRow = { locationId?: string; ok?: boolean; error?: string }
type CronRow = {
  source?: string
  jobType?: string
  lastSyncOk?: boolean
  lastSyncAt?: string
  lastSyncMessage?: string
  lastSyncDetail?: {
    ok?: boolean
    locations?: BorkLocationRow[]
    jobType?: string
  }
}

function syncWindowForJob(jobType: string): { startDate: string; endDate: string } {
  const openRegister = amsterdamOpenRegisterBusinessDateYmd()
  const histDays = historicalLookbackDaysForJobType(jobType)
  if (histDays != null) {
    const endDate = addCalendarDaysYmd(openRegister, -1)
    return {
      startDate: addCalendarDaysYmd(endDate, -(histDays - 1)),
      endDate,
    }
  }
  return {
    startDate: addCalendarDaysYmd(openRegister, -1),
    endDate: openRegister,
  }
}

function failedBorkLocations(detail: CronRow['lastSyncDetail']): BorkLocationRow[] {
  const rows = detail?.locations ?? []
  return rows.filter((r) => r.ok === false)
}

function isSyncFailure(row: CronRow): boolean {
  if (row.lastSyncOk === false) return true
  if (row.lastSyncDetail?.ok === false) return true
  if (failedBorkLocations(row.lastSyncDetail).length > 0) return true
  return false
}

export async function detectIntegrationSyncFailureNotifications(db: Db): Promise<OpsNotificationDto[]> {
  const items: OpsNotificationDto[] = []
  const businessDate = amsterdamOpenRegisterBusinessDateYmd()

  const rows = await db
    .collection<CronRow>('integration_cron_jobs')
    .find({
      jobType: { $in: [...WATCHED_JOB_TYPES] },
      $nor: [{ isActive: false }],
    })
    .toArray()

  for (const row of rows) {
    const source = row.source === 'eitje' ? 'eitje' : 'bork'
    const jobType = String(row.jobType ?? '')
    if (!WATCHED_JOB_TYPES.has(jobType)) continue
    if (!isSyncFailure(row)) continue

    const failedLocs = failedBorkLocations(row.lastSyncDetail)
    const failedCount = failedLocs.length
    const totalLocs = row.lastSyncDetail?.locations?.length ?? 0
    const notificationId = `integration_sync_partial_failure:${businessDate}:integration:${source}:${jobType}`
    const pause = await integrationAutoRetryPaused(db, notificationId, failedLocs)
    // Chronic per-location failures: auto-retry already stopped — do not re-spam the inbox.
    if (pause.paused && failedCount > 0) continue

    const partialMsg =
      failedCount > 0 && totalLocs > 0
        ? `${source} ${jobType} synced ${totalLocs - failedCount}/${totalLocs} location(s) — ${failedCount} failed.`
        : `${source} ${jobType} last sync failed (lastSyncOk=false).`

    const window = syncWindowForJob(jobType)
    items.push(
      buildNotificationItem({
        kind: 'integration_sync_partial_failure',
        businessDate,
        locationId: `integration:${source}:${jobType}`,
        locationName: `${source === 'bork' ? 'Bork' : 'Eitje'} pipeline`,
        message: `${partialMsg} ${String(row.lastSyncMessage ?? '').slice(0, 200)}`,
        fixHint: `Auto-retry re-runs failed location(s) only, then rebuilds snapshots + read-cache for ${window.startDate}..${window.endDate}. After ${MAX_INTEGRATION_LOCATION_RETRY_STREAK} fails per location, alert pauses — fix api_credentials + POST /api/bork/v2/sync.`,
        meta: {
          source,
          jobType,
          lastSyncAt: row.lastSyncAt,
          failedLocations: failedLocs,
          syncWindow: window,
        },
      }),
    )
  }

  return items
}
