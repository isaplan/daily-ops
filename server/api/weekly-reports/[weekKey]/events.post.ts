import { getDb } from '~/server/utils/db'
import { getEventsForRange, insertCustomCalendarEvent } from '~/server/utils/dailyOpsCalendarEvents/getEventsForRange'
import { weekRangeFromKey } from '~/server/utils/dailyOpsWeeklyReport/weekRange'
import { WEEKLY_REPORTS_COLLECTION } from '~/server/utils/weeklyReportDocument/constants'
import { upsertWeeklyReportDocument } from '~/server/utils/weeklyReportDocument/upsertWeeklyReportDocument'

export default defineEventHandler(async (event) => {
  const weekKey = getRouterParam(event, 'weekKey')
  if (!weekKey) throw createError({ statusCode: 400, message: 'weekKey required' })

  const body = await readBody<{
    title?: string
    startDate?: string
    endDate?: string
    note?: string
    locationId?: string
  }>(event)

  const title = body?.title?.trim()
  const startDate = body?.startDate
  const endDate = body?.endDate ?? startDate
  const locationId = body?.locationId

  if (!title || !startDate || !endDate || !locationId) {
    throw createError({ statusCode: 400, message: 'title, startDate, endDate, locationId required' })
  }

  const range = weekRangeFromKey(weekKey)
  if (!range) throw createError({ statusCode: 400, message: 'Invalid weekKey' })

  const db = await getDb()
  const eventRow = await insertCustomCalendarEvent(db, {
    startDate,
    endDate,
    type: 'custom',
    title,
    note: body?.note,
  })

  const events = await getEventsForRange(db, range.startDate, range.endDate)
  await db.collection(WEEKLY_REPORTS_COLLECTION).updateOne(
    { weekKey, locationId },
    { $set: { events } },
    { upsert: false },
  )

  const data = await upsertWeeklyReportDocument(db, weekKey, locationId)
  return { success: true, data: { ...data, events }, event: eventRow }
})
