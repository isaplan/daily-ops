/**
 * @registry-id: inboxWatchGetAPI
 * @last-modified: 2026-04-19T12:00:00.000Z
 * @description: GET /api/inbox/watch — last renewal + Gmail watchExpiration from integration_cron_jobs
 * @last-fix: [2026-04-19] Replaced stub with DB-backed status
 */
import { getDb } from '../../utils/db'
import { ensureInboxCollections } from '../../utils/inbox/collections'

export default defineEventHandler(async () => {
  await ensureInboxCollections()
  const db = await getDb()
  const row = await db.collection('integration_cron_jobs').findOne({
    source: 'gmail',
    jobType: 'inbox-watch',
  })

  return {
    success: true,
    data: {
      isActive: row?.isActive === true,
      topicName: typeof row?.topicName === 'string' ? row.topicName : null,
      watchExpiration: typeof row?.watchExpiration === 'string' ? row.watchExpiration : null,
      lastHistoryId: typeof row?.lastHistoryId === 'string' ? row.lastHistoryId : null,
      lastRenewalAt: typeof row?.lastSyncAt === 'string' ? row.lastSyncAt : null,
      lastSyncOk: row?.lastSyncOk === true,
      lastSyncMessage: typeof row?.lastSyncMessage === 'string' ? row.lastSyncMessage : null,
      hint:
        'Gmail push watches expire (~7 days). Renew via POST /api/inbox/watch or scheduled GET /api/inbox/watch/renew?secret=…',
    },
  }
})
