import { getDb } from '~/server/utils/db'
import { setWeeklyReportLock } from '~/server/utils/weeklyReportDocument/upsertWeeklyReportDocument'

const WEEK_KEY_RE = /^\d{4}-W\d{2}$/

export default defineEventHandler(async (event) => {
  const weekKey = getRouterParam(event, 'weekKey')
  if (!weekKey || !WEEK_KEY_RE.test(weekKey)) {
    throw createError({ statusCode: 400, message: 'Invalid weekKey' })
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
  const data = await setWeeklyReportLock(db, weekKey, locationId, body.locked)
  return { success: true, data }
})
