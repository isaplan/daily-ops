import type { BlockAgree, BlockTodo } from '~/types/noteBlock'
import { parseBlockAgrees, parseBlockTodos } from '~/lib/utils/blockTodoParser'
import { WEEKLY_REPORT_SECTION_KEYS, type WeeklyReportSectionKey } from '~/types/weeklyReportDocument'
import { getDb } from '~/server/utils/db'
import { findWeeklyReportDocument, saveWeeklyReportSection } from '~/server/utils/weeklyReportDocument/upsertWeeklyReportDocument'

export default defineEventHandler(async (event) => {
  const weekKey = getRouterParam(event, 'weekKey')
  const sectionKey = getRouterParam(event, 'sectionKey')
  if (!weekKey || !sectionKey) {
    throw createError({ statusCode: 400, message: 'weekKey and sectionKey required' })
  }
  if (!WEEKLY_REPORT_SECTION_KEYS.includes(sectionKey as WeeklyReportSectionKey)) {
    throw createError({ statusCode: 400, message: 'Invalid sectionKey' })
  }

  const body = await readBody<{
    text?: string
    locationId?: string
    todos?: BlockTodo[]
    agrees?: BlockAgree[]
  }>(event)
  const locationId = body?.locationId
  if (!locationId) {
    throw createError({ statusCode: 400, message: 'locationId is required' })
  }

  const text = typeof body?.text === 'string' ? body.text : ''
  const db = await getDb()
  const existing = await findWeeklyReportDocument(db, weekKey, locationId)
  const section = existing?.sections[sectionKey as WeeklyReportSectionKey]
  const existingTodos = section?.todos ?? []
  const existingAgrees = section?.agrees ?? []

  const todos = Array.isArray(body?.todos)
    ? body.todos
    : parseBlockTodos(text, existingTodos)
  const agrees = Array.isArray(body?.agrees)
    ? body.agrees
    : parseBlockAgrees(text, existingAgrees)

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
