import { getDb } from '../../../utils/db'

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
  const query = { source: 'eitje', jobType: body.jobType }

  if (body.action === 'update') {
    await db.collection('integration_cron_jobs').updateOne(
      query,
      {
        $set: {
          ...body.config,
          source: 'eitje',
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
          source: 'eitje',
          jobType: body.jobType,
          lastRun: now.toISOString(),
          lastRunUTC: now.toISOString(),
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now, isActive: true },
      },
      { upsert: true },
    )
    return { success: true, message: 'Run triggered' }
  }

  await db.collection('integration_cron_jobs').updateOne(
    query,
    {
      $set: {
        source: 'eitje',
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
