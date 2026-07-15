/**
 * @registry-id: integrationSyncRetryStreak
 * @created: 2026-07-15T00:00:00.000Z
 * @last-modified: 2026-07-16T00:00:00.000Z
 * @description: Per-location consecutive auto-retry streak for integration sync failures
 * @last-fix: [2026-07-16] Detector skips emit when all failed locations are chronic
 *   Prior: [2026-07-15] Cap auto-retry after chronic Bork location failures
 *
 * @exports-to:
 * ✓ server/utils/opsNotifications/autoRetry.ts
 * ✓ server/utils/opsNotifications/tryFixNotification.ts
 * ✓ server/utils/opsNotifications/detectors/integrationSyncFailures.ts
 */

import type { Db } from 'mongodb'

export const INTEGRATION_SYNC_RETRY_ATTEMPTS = 'ops_notification_auto_retry_attempts'
export const MAX_INTEGRATION_LOCATION_RETRY_STREAK = 3

type AttemptRow = {
  _id: string
  attemptedAt: Date
  consecutiveFailures?: number
}

type FailedLocationRow = { locationId?: string; error?: string }

export function integrationLocationRetryId (notificationId: string, locationId: string): string {
  return `${notificationId}:loc:${locationId}`
}

export async function readIntegrationLocationRetryStreak (
  db: Db,
  notificationId: string,
  locationId: string,
): Promise<number> {
  const row = await db.collection<AttemptRow>(INTEGRATION_SYNC_RETRY_ATTEMPTS).findOne({
    _id: integrationLocationRetryId(notificationId, locationId),
  })
  return row?.consecutiveFailures ?? 0
}

export async function recordIntegrationLocationRetryOutcome (
  db: Db,
  notificationId: string,
  locationId: string,
  fixed: boolean,
): Promise<void> {
  const id = integrationLocationRetryId(notificationId, locationId)
  if (fixed) {
    await db.collection(INTEGRATION_SYNC_RETRY_ATTEMPTS).deleteOne({ _id: id })
    return
  }
  const existing = await db.collection<AttemptRow>(INTEGRATION_SYNC_RETRY_ATTEMPTS).findOne({ _id: id })
  const consecutiveFailures = (existing?.consecutiveFailures ?? 0) + 1
  await db.collection(INTEGRATION_SYNC_RETRY_ATTEMPTS).updateOne(
    { _id: id },
    {
      $set: {
        attemptedAt: new Date(),
        status: 'failed',
        consecutiveFailures,
      },
    },
    { upsert: true },
  )
}

export async function integrationAutoRetryPaused (
  db: Db,
  notificationId: string,
  failedLocations: FailedLocationRow[],
): Promise<{ paused: boolean; chronicLocationIds: string[] }> {
  const chronicLocationIds: string[] = []
  for (const loc of failedLocations) {
    const locationId = loc.locationId != null ? String(loc.locationId) : ''
    if (!locationId) continue
    const streak = await readIntegrationLocationRetryStreak(db, notificationId, locationId)
    if (streak >= MAX_INTEGRATION_LOCATION_RETRY_STREAK) {
      chronicLocationIds.push(locationId)
    }
  }
  if (chronicLocationIds.length === 0) {
    return { paused: false, chronicLocationIds: [] }
  }
  const allFailedHaveChronicStreak = failedLocations.every((loc) => {
    const locationId = loc.locationId != null ? String(loc.locationId) : ''
    return !locationId || chronicLocationIds.includes(locationId)
  })
  return { paused: allFailedHaveChronicStreak, chronicLocationIds }
}
