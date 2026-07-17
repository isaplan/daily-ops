import { getDb } from '~/server/utils/db'
import { setMonthlyReportLock } from '~/server/utils/monthlyReportDocument/upsertMonthlyReportDocument'

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export default defineEventHandler(async (event) => {
  const monthKey = getRouterParam(event, 'monthKey')
  if (!monthKey || !MONTH_KEY_RE.test(monthKey)) {
    throw createError({ statusCode: 400, message: 'Invalid monthKey' })
  }

  const body = await readBody<{ locationId?: string; locked?: boolean }>(event)
  const locationId = body?.locationId
  if (!locationId) {
    throw createError({ statusCode: 400, message: 'locationId is required' })
  }
  if (typeof body?.locked !== 'boolean') {
    throw createError({ statusCode: 400, message: 'locked boolean is required' })
  }

  const db = await getDb()
  const data = await setMonthlyReportLock(db, monthKey, locationId, body.locked)
  return { success: true, data }
})
