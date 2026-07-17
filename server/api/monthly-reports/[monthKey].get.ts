import { getDb } from '~/server/utils/db'
import { upsertMonthlyReportDocument } from '~/server/utils/monthlyReportDocument/upsertMonthlyReportDocument'

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export default defineEventHandler(async (event) => {
  const monthKey = getRouterParam(event, 'monthKey')
  if (!monthKey || !MONTH_KEY_RE.test(monthKey)) {
    throw createError({ statusCode: 400, message: 'Invalid monthKey' })
  }

  const query = getQuery(event)
  const locationId = typeof query.locationId === 'string' ? query.locationId : undefined
  if (!locationId) {
    throw createError({ statusCode: 400, message: 'locationId is required' })
  }

  const db = await getDb()
  const data = await upsertMonthlyReportDocument(db, monthKey, locationId)
  return { success: true, data }
})
