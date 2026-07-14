import { getDb } from '~/server/utils/db'
import { listWeeklyReports } from '~/server/utils/weeklyReportDocument/upsertWeeklyReportDocument'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const locationId = typeof query.locationId === 'string' ? query.locationId : undefined
  const limit = Math.min(104, Math.max(1, Number(query.limit) || 52))

  const db = await getDb()
  const data = await listWeeklyReports(db, { locationId, limit })
  return { success: true, data }
})
