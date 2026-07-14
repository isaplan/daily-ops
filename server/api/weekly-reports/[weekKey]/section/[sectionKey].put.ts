import { parseBlockAgrees, parseBlockTodos } from '~/lib/utils/blockTodoParser'
import { WEEKLY_REPORT_SECTION_KEYS, type WeeklyReportSectionKey } from '~/types/weeklyReportDocument'
import { getDb } from '~/server/utils/db'
import { saveWeeklyReportSection } from '~/server/utils/weeklyReportDocument/upsertWeeklyReportDocument'

export default defineEventHandler(async (event) => {
  const weekKey = getRouterParam(event, 'weekKey')
  const sectionKey = getRouterParam(event, 'sectionKey')
  if (!weekKey || !sectionKey) {
    throw createError({ statusCode: 400, message: 'weekKey and sectionKey required' })
  }
  if (!WEEKLY_REPORT_SECTION_KEYS.includes(sectionKey as WeeklyReportSectionKey)) {
    throw createError({ statusCode: 400, message: 'Invalid sectionKey' })
  }

  const body = await readBody<{ text?: string; locationId?: string }>(event)
  const locationId = body?.locationId
  if (!locationId) {
    throw createError({ statusCode: 400, message: 'locationId is required' })
  }

  const text = typeof body?.text === 'string' ? body.text : ''
  const todos = parseBlockTodos(text, [])
  const agrees = parseBlockAgrees(text, [])

  const db = await getDb()
  const data = await saveWeeklyReportSection(
    db,
    weekKey,
    locationId,
    sectionKey,
    text,
    todos,
    agrees,
  )
  return { success: true, data }
})
