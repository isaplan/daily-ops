import { getDb } from '~/server/utils/db'
import { getEventsForRange, insertCustomCalendarEvent } from '~/server/utils/dailyOpsCalendarEvents/getEventsForRange'
import { monthRangeFromKey } from '~/server/utils/dailyOpsMonthlyReport/monthRange'
import { MONTHLY_REPORTS_COLLECTION } from '~/server/utils/monthlyReportDocument/constants'
import { upsertMonthlyReportDocument } from '~/server/utils/monthlyReportDocument/upsertMonthlyReportDocument'

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export default defineEventHandler(async (event) => {
  const monthKey = getRouterParam(event, 'monthKey')
  if (!monthKey || !MONTH_KEY_RE.test(monthKey)) {
    throw createError({ statusCode: 400, message: 'monthKey required' })
  }

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

  const range = monthRangeFromKey(monthKey)
  if (!range) throw createError({ statusCode: 400, message: 'Invalid monthKey' })

  const db = await getDb()
  const eventRow = await insertCustomCalendarEvent(db, {
    startDate,
    endDate,
    type: 'custom',
    title,
    note: body?.note,
  })

  const events = await getEventsForRange(db, range.startDate, range.endDate)
  await db.collection(MONTHLY_REPORTS_COLLECTION).updateOne(
    { monthKey, locationId },
    { $set: { events } },
    { upsert: false },
  )

  const data = await upsertMonthlyReportDocument(db, monthKey, locationId)
  return { success: true, data: { ...data, events }, event: eventRow }
})
