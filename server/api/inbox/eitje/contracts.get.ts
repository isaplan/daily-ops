import { getInboxImportTablePayload, parseInboxImportTableQuery } from '../../../utils/inbox/inboxImportTableQuery'

export default defineEventHandler(async (event) => {
  try {
    const q = getQuery(event)
    const data = await getInboxImportTablePayload('contracts', parseInboxImportTableQuery(q))
    return { success: true as const, data }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load inbox Eitje contracts',
    })
  }
})
