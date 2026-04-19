/**
 * @registry-id: inboxWatchPostAPI
 * @last-modified: 2026-04-19T12:00:00.000Z
 * @description: POST /api/inbox/watch — start Gmail users.watch; persists state to integration_cron_jobs
 * @last-fix: [2026-04-19] Upsert gmail inbox-watch job row after successful watch
 */
import { getDb } from '../../utils/db'
import { ensureInboxCollections } from '../../utils/inbox/collections'
import { gmailWatchService } from '../../services/gmailWatchService'

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
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to start Gmail watch',
    })
  }
})
