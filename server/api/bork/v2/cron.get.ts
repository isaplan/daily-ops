import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const jobType = (getQuery(event).jobType as string) || 'daily-data'
  const db = await getDb()
  const row = await db.collection('integration_cron_jobs').findOne({ source: 'bork', jobType })

  return {
    success: true,
    data: row
      ? {
          isActive: Boolean(row.isActive),
          lastRun: row.lastRun || null,
          lastRunUTC: row.lastRunUTC || null,
          schedule: row.schedule || null,
          lastSyncAt: row.lastSyncAt ?? null,
          lastSyncOk: row.lastSyncOk ?? null,
          lastSyncMessage: row.lastSyncMessage ?? null,
          lastSyncDetail: row.lastSyncDetail ?? null,
        }
      : null,
  }
})
