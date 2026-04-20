/**
 * @registry-id: inboxGmailWatchRenewAPI
 * @created: 2026-04-19T12:00:00.000Z
 * @last-modified: 2026-04-20T00:00:00.000Z
 * @description: GET /api/inbox/watch/renew — Gmail users.watch renewal for schedulers (GitHub Actions, DO cron)
 * @last-fix: [2026-04-20] Map invalid_grant to 401 + gmailOAuthError helper
 *
 * @exports-to:
 *   ✓ .github/workflows/gmail-watch-renew.yml
 */

import { getDb } from '../../../utils/db'
import { ensureInboxCollections } from '../../../utils/inbox/collections'
import { gmailWatchService } from '../../../services/gmailWatchService'
import { getGmailOAuthErrorMessage, isInvalidGrantError } from '../../../utils/gmailOAuthError'

const GMAIL_WATCH_JOB = { source: 'gmail', jobType: 'inbox-watch' } as const

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  const q = getQuery(event)
  if (!secret || String(q.secret ?? '') !== secret) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const topicName = process.env.GMAIL_PUBSUB_TOPIC
  if (!topicName) {
    throw createError({
      statusCode: 500,
      statusMessage: 'GMAIL_PUBSUB_TOPIC is not set on the server',
    })
  }

  await ensureInboxCollections()
  const db = await getDb()
  const now = new Date()

  try {
    const result = await gmailWatchService.watch({
      topicName,
      labelIds: ['INBOX'],
    })

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
          lastSyncMessage: 'Gmail users.watch renewed (scheduled)',
          lastSyncDetail: result,
          updatedAt: now,
          isActive: true,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    )

    return {
      success: true,
      data: {
        historyId: result.historyId,
        expiration: result.expiration,
        topicName,
      },
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Gmail watch renew failed'
    await db.collection('integration_cron_jobs').updateOne(
      { ...GMAIL_WATCH_JOB },
      {
        $set: {
          ...GMAIL_WATCH_JOB,
          lastSyncAt: now.toISOString(),
          lastSyncOk: false,
          lastSyncMessage: msg,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    ).catch(() => {})

    if (isInvalidGrantError(error)) {
      throw createError({
        statusCode: 401,
        statusMessage:
          'Gmail OAuth invalid_grant: refresh token rejected. Match GMAIL_REDIRECT_URI and OAuth client to the values used when GMAIL_REFRESH_TOKEN was issued; re-authorize and update env.',
        data: { google: getGmailOAuthErrorMessage(error) },
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: msg,
    })
  }
})
