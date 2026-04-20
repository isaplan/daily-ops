/**
 * @registry-id: inboxWatchPostAPI
 * @last-modified: 2026-04-20T00:00:00.000Z
 * @description: POST /api/inbox/watch — start Gmail users.watch; persists state to integration_cron_jobs
 * @last-fix: [2026-04-20] invalid_grant → 401 + gmailOAuthError helper
 */
import { getDb } from '../../utils/db'
import { ensureInboxCollections } from '../../utils/inbox/collections'
import { gmailWatchService } from '../../services/gmailWatchService'
import { getGmailOAuthErrorMessage, isInvalidGrantError } from '../../utils/gmailOAuthError'

const GMAIL_WATCH_JOB = { source: 'gmail', jobType: 'inbox-watch' } as const

export default defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections()

    const body = await readBody(event).catch(() => ({})) as { topicName?: string; labelIds?: string[] }
    const topicName = body.topicName || process.env.GMAIL_PUBSUB_TOPIC

    if (!topicName) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Pub/Sub topic name is required. Set GMAIL_PUBSUB_TOPIC or provide topicName in request body.',
      })
    }

    const result = await gmailWatchService.watch({
      topicName,
      labelIds: body.labelIds || ['INBOX'],
    })

    const db = await getDb()
    const now = new Date()
    await db.collection('integration_cron_jobs').updateOne(
      { ...GMAIL_WATCH_JOB },
      {
        $set: {
          ...GMAIL_WATCH_JOB,
          topicName,
          labelIds: body.labelIds || ['INBOX'],
          watchExpiration: result.expiration,
          lastHistoryId: result.historyId,
          lastSyncAt: now.toISOString(),
          lastSyncOk: true,
          lastSyncMessage: 'Gmail users.watch started (manual or API)',
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
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    const msg = getGmailOAuthErrorMessage(error)
    if (isInvalidGrantError(error)) {
      throw createError({
        statusCode: 401,
        statusMessage:
          'Gmail OAuth invalid_grant: refresh token rejected. Use the same GMAIL_CLIENT_ID/SECRET as when the token was created; set GMAIL_REDIRECT_URI to the exact authorized redirect URI (e.g. http://localhost:8080). Then re-run OAuth and replace GMAIL_REFRESH_TOKEN.',
        data: { google: msg },
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: msg,
    })
  }
})
