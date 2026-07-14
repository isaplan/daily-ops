import { getDb } from '~/server/utils/db'
import { upsertWeeklyReportDocument } from '~/server/utils/weeklyReportDocument/upsertWeeklyReportDocument'

export default defineEventHandler(async (event) => {
  const weekKey = getRouterParam(event, 'weekKey')
  if (!weekKey || !/^\d{4}-W\d{2}$/.test(weekKey)) {
    throw createError({ statusCode: 400, message: 'Invalid weekKey' })
  }

  const query = getQuery(event)
  const locationId = typeof query.locationId === 'string' ? query.locationId : undefined
  if (!locationId) {
    throw createError({ statusCode: 400, message: 'locationId is required' })
  }

  const db = await getDb()
  const data = await upsertWeeklyReportDocument(db, weekKey, locationId)
  return { success: true, data }
})
