import { getDb } from '~/server/utils/db'
import { listMonthlyReports } from '~/server/utils/monthlyReportDocument/upsertMonthlyReportDocument'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const locationId = typeof query.locationId === 'string' ? query.locationId : undefined
  const limit = Math.min(72, Math.max(1, Number(query.limit) || 36))

  const db = await getDb()
  const data = await listMonthlyReports(db, { locationId, limit })
  return { success: true, data }
})
