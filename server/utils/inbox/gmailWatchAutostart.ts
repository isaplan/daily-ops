/**
 * @registry-id: gmailWatchAutostart
 * @created: 2026-04-20T00:00:00.000Z
 * @last-modified: 2026-04-20T00:00:00.000Z
 * @description: On Nitro startup, ensure Gmail users.watch is registered (no manual “Start watch”)
 * @last-fix: [2026-04-20] Initial — skip if watchExpiration still valid (~1d buffer); opt-out GMAIL_AUTO_WATCH_ON_START=0
 *
 * @exports-to:
 * ✓ server/plugins/gmail-inbox-watch-autostart.ts
 */

import { getDb } from '../db'
import { ensureInboxCollections } from './collections'
import { gmailWatchService } from '../../services/gmailWatchService'

const GMAIL_WATCH_JOB = { source: 'gmail', jobType: 'inbox-watch' } as const

/** Gmail returns expiration as milliseconds since epoch (string). */
function parseExpirationMs(raw: unknown): number | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

const BUFFER_MS = 24 * 60 * 60 * 1000

export type GmailWatchAutostartResult =
  | { action: 'skipped'; reason: string }
  | { action: 'started'; expiration: string; topicName: string }
  | { action: 'error'; message: string }

/**
 * Called from Nitro `ready` hook. Does not throw (startup must not crash).
 */
export async function ensureGmailWatchIfNeeded(): Promise<GmailWatchAutostartResult> {
  if (process.env.GMAIL_AUTO_WATCH_ON_START === '0') {
    return { action: 'skipped', reason: 'GMAIL_AUTO_WATCH_ON_START=0' }
  }

  const topicName = process.env.GMAIL_PUBSUB_TOPIC
  if (!topicName) {
    return { action: 'skipped', reason: 'GMAIL_PUBSUB_TOPIC not set' }
  }

  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    return { action: 'skipped', reason: 'Gmail OAuth env incomplete' }
  }

  try {
    await ensureInboxCollections()
    const db = await getDb()
    const row = await db.collection('integration_cron_jobs').findOne({ ...GMAIL_WATCH_JOB })
    const expMs = parseExpirationMs(row?.watchExpiration)
    if (expMs != null && expMs > Date.now() + BUFFER_MS) {
      return {
        action: 'skipped',
        reason: `watch still valid until ${new Date(expMs).toISOString()}`,
      }
    }

    const result = await gmailWatchService.watch({
      topicName,
      labelIds: ['INBOX'],
    })

    const now = new Date()
    await db.collection('integration_cron_jobs').updateOne(
      { ...GMAIL_WATCH_JOB },
      {
        $set: {
          ...GMAIL_WATCH_JOB,
          topicName,
          labelIds: ['INBOX'],
          watchExpiration: result.expiration,
          lastHistoryId: result.historyId,
          lastSyncAt: now.toISOString(),
          lastSyncOk: true,
          lastSyncMessage: 'Gmail users.watch started (Nitro autostart)',
          lastSyncDetail: result,
          updatedAt: now,
          isActive: true,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    )

    return {
      action: 'started',
      expiration: result.expiration,
      topicName,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    try {
      const db = await getDb()
      const now = new Date()
      await db.collection('integration_cron_jobs').updateOne(
        { ...GMAIL_WATCH_JOB },
        {
          $set: {
            ...GMAIL_WATCH_JOB,
            lastSyncAt: now.toISOString(),
            lastSyncOk: false,
            lastSyncMessage: `Autostart failed: ${message}`,
            updatedAt: now,
            isActive: false,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      )
    } catch {
      // ignore secondary failure
    }
    return { action: 'error', message }
  }
}
