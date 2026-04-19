import { ensureInboxCollections, ensureInboxIndexes } from '../../utils/inbox/collections'
import { processAllUnprocessed } from '../../services/inboxProcessService'

export default defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections()
    await ensureInboxIndexes()

    const body = await readBody(event).catch(() => ({})) as { maxEmails?: number }
    const maxEmails = body.maxEmails ?? 50

    const data = await processAllUnprocessed(maxEmails)
    return { success: true, data }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to process all emails',
    })
  }
})
