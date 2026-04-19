import { getDb } from '../../utils/db'
import { ensureInboxCollections } from '../../utils/inbox/collections'
import { gmailWatchService } from '../../services/gmailWatchService'

const GMAIL_WATCH_JOB = { source: 'gmail', jobType: 'inbox-watch' } as const

export default defineEventHandler(async () => {
  try {
    await ensureInboxCollections()
    await gmailWatchService.stop()
    const db = await getDb()
    const now = new Date()
    await db.collection('integration_cron_jobs').updateOne(
      { ...GMAIL_WATCH_JOB },
      {
        $set: {
          isActive: false,
          lastSyncMessage: 'Gmail users.stop called',
          updatedAt: now,
        },
      },
    )
    return { success: true, data: { message: 'Gmail watch stopped successfully' } }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to stop Gmail watch',
    })
  }
})
