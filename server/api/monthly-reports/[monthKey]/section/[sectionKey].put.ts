import type { BlockAgree, BlockTodo } from '~/types/noteBlock'
import { parseBlockAgrees, parseBlockTodos } from '~/lib/utils/blockTodoParser'
import { MONTHLY_REPORT_SECTION_KEYS, type MonthlyReportSectionKey } from '~/types/monthlyReportDocument'
import { getDb } from '~/server/utils/db'
import { findMonthlyReportDocument, saveMonthlyReportSection } from '~/server/utils/monthlyReportDocument/upsertMonthlyReportDocument'

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export default defineEventHandler(async (event) => {
  const monthKey = getRouterParam(event, 'monthKey')
  const sectionKey = getRouterParam(event, 'sectionKey')
  if (!monthKey || !sectionKey) {
    throw createError({ statusCode: 400, message: 'monthKey and sectionKey required' })
  }
  if (!MONTH_KEY_RE.test(monthKey)) {
    throw createError({ statusCode: 400, message: 'Invalid monthKey' })
  }
  if (!MONTHLY_REPORT_SECTION_KEYS.includes(sectionKey as MonthlyReportSectionKey)) {
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
  const existing = await findMonthlyReportDocument(db, monthKey, locationId)
  const section = existing?.sections[sectionKey as MonthlyReportSectionKey]
  const existingTodos = section?.todos ?? []
  const existingAgrees = section?.agrees ?? []

  const todos = Array.isArray(body?.todos)
    ? body.todos
    : parseBlockTodos(text, existingTodos)
  const agrees = Array.isArray(body?.agrees)
    ? body.agrees
    : parseBlockAgrees(text, existingAgrees)

  const data = await saveMonthlyReportSection(
    db,
    monthKey,
    locationId,
    sectionKey,
    text,
    todos,
    agrees,
  )
  return { success: true, data }
})
