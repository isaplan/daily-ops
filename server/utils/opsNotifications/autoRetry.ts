import type { Db } from 'mongodb'
import { tryFixOpsNotification } from './tryFixNotification'
import { runOpsNotificationScan } from './runOpsNotificationScan'
import type { OpsNotificationKind } from '~/types/ops-notifications'

const AUTO_RETRY_KINDS: OpsNotificationKind[] = [
  'missing_revenue_snapshot',
  'missing_labor_snapshot',
  'missing_master_snapshot',
  'bork_inbox_revenue_gap',
  'bork_revenue_aggregation_stale',
  'unparsed_basis_attachment',
]

const ATTEMPT_COLLECTION = 'ops_notification_auto_retry_attempts'
const LOCK_COLLECTION = 'ops_notification_auto_retry_lock'
const COOLDOWN_MS = 10 * 60 * 1000
const MAX_PER_RUN = 10

type AttemptRow = {
  _id: string
  attemptedAt: Date
  status: 'fixed' | 'open' | 'failed'
  message: string
}

function inCronSensitiveWindow(now: Date): boolean {
  const minute = now.getMinutes()
  // Avoid heavy auto-fix overlap near 00/05 cron windows.
  return minute <= 12
}

export async function runOpsNotificationAutoRetry(db: Db): Promise<{
  ok: boolean
  scanned: number
  attempted: number
  fixed: number
  skipped: string[]
}> {
  const now = new Date()
  const skipped: string[] = []

  if (inCronSensitiveWindow(now)) {
    return { ok: true, scanned: 0, attempted: 0, fixed: 0, skipped: ['cron_sensitive_window'] }
  }

  const lockId = 'global'
  const lock = await db.collection(LOCK_COLLECTION).findOneAndUpdate(
    {
      _id: lockId,
      $or: [{ running: { $ne: true } }, { lockedAt: { $lt: new Date(Date.now() - 8 * 60 * 1000) } }],
    },
    { $set: { _id: lockId, running: true, lockedAt: now } },
    { upsert: true, returnDocument: 'after' },
  )
  if (!lock) {
    return { ok: true, scanned: 0, attempted: 0, fixed: 0, skipped: ['lock_unavailable'] }
  }

  let attempted = 0
  let fixed = 0
  let scanned = 0
  try {
    const report = await runOpsNotificationScan(db, {
      lookbackDays: 3,
      skipArchitecture: true,
      includeHidden: false,
    })
    scanned = report.total

    for (const item of report.items) {
      if (attempted >= MAX_PER_RUN) break
      if (!AUTO_RETRY_KINDS.includes(item.kind)) continue
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.businessDate)) continue
      if (!item.locationId || item.locationId === 'platform') continue

      const previous = await db.collection<AttemptRow>(ATTEMPT_COLLECTION).findOne({ _id: item.id })
      if (previous?.attemptedAt && Date.now() - previous.attemptedAt.getTime() < COOLDOWN_MS) {
        skipped.push(`cooldown:${item.id}`)
        continue
      }

      const result = await tryFixOpsNotification(db, {
        kind: item.kind,
        businessDate: item.businessDate,
        locationId: item.locationId,
        meta: item.meta,
      })
      attempted += 1
      if (result.fixed) fixed += 1
      await db.collection<AttemptRow>(ATTEMPT_COLLECTION).updateOne(
        { _id: item.id },
        {
          $set: {
            attemptedAt: new Date(),
            status: result.fixed ? 'fixed' : result.ok ? 'open' : 'failed',
            message: result.message,
          },
        },
        { upsert: true },
      )
    }
    return { ok: true, scanned, attempted, fixed, skipped }
  } finally {
    await db.collection(LOCK_COLLECTION).updateOne(
      { _id: lockId },
      { $set: { running: false, unlockedAt: new Date() } },
      { upsert: true },
    )
  }
}
