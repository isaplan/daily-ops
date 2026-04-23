import { getDb } from '../../../utils/db'
import { runIntegrationCronJob } from '../../../services/integrationCronRunner'

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
    const { syncResult } = await runIntegrationCronJob(db, 'bork', body.jobType)
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
