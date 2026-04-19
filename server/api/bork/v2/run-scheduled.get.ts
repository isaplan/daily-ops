import { getDb } from '../../../utils/db'
import { executeBorkJob } from '../../../services/borkSyncService'

/**
 * External scheduler hook (e.g. Vercel Cron, GitHub Actions) with ?secret= matching CRON_SECRET.
 * Runs all active Bork integration_cron_jobs once per request.
 */
export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  const q = getQuery(event)
  if (!secret || String(q.secret ?? '') !== secret) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = await getDb()
  const jobs = await db
    .collection('integration_cron_jobs')
    .find({ source: 'bork', isActive: true })
    .toArray()

  const results: unknown[] = []
  const now = new Date()

  for (const j of jobs) {
    const jobType = typeof j.jobType === 'string' ? j.jobType : ''
    if (!jobType) continue

    await db.collection('integration_cron_jobs').updateOne(
      { source: 'bork', jobType },
      { $set: { lastRun: now.toISOString(), lastRunUTC: now.toISOString(), updatedAt: now } },
    )

    const syncResult = await executeBorkJob(db, jobType)
    results.push({ jobType, ...syncResult })

    await db.collection('integration_cron_jobs').updateOne(
      { source: 'bork', jobType },
      {
        $set: {
          lastSyncAt: now.toISOString(),
          lastSyncOk: syncResult.ok,
          lastSyncMessage: syncResult.message,
          lastSyncDetail: syncResult,
          updatedAt: new Date(),
        },
      },
    )
  }

  return { success: true, ran: results.length, results }
})
