import { getDb } from '../../../utils/db'
import { executeBorkJob } from '../../../services/borkSyncService'

type Body = {
  action: 'start' | 'stop' | 'run-now' | 'update'
  jobType: string
  config?: Record<string, unknown>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  if (!body?.jobType || !body?.action) {
    throw createError({ statusCode: 400, statusMessage: 'jobType and action are required' })
  }

  const db = await getDb()
  const now = new Date()
  const query = { source: 'bork', jobType: body.jobType }

  if (body.action === 'update') {
    await db.collection('integration_cron_jobs').updateOne(
      query,
      {
        $set: {
          ...body.config,
          source: 'bork',
          jobType: body.jobType,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    )
    return { success: true, message: 'Cron config updated' }
  }

  if (body.action === 'run-now') {
    await db.collection('integration_cron_jobs').updateOne(
      query,
      {
        $set: {
          source: 'bork',
          jobType: body.jobType,
          lastRun: now.toISOString(),
          lastRunUTC: now.toISOString(),
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now, isActive: true },
      },
      { upsert: true },
    )

    const syncResult = await executeBorkJob(db, body.jobType)
    await db.collection('integration_cron_jobs').updateOne(query, {
      $set: {
        lastSyncAt: now.toISOString(),
        lastSyncOk: syncResult.ok,
        lastSyncMessage: syncResult.message,
        lastSyncDetail: syncResult,
        updatedAt: new Date(),
      },
    })

    return {
      success: syncResult.ok,
      message: syncResult.message,
      sync: syncResult,
    }
  }

  await db.collection('integration_cron_jobs').updateOne(
    query,
    {
      $set: {
        source: 'bork',
        jobType: body.jobType,
        isActive: body.action === 'start',
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  )

  return { success: true, message: `Job ${body.action}ed` }
})
