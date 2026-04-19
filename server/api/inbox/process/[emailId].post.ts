import { ensureInboxCollections, ensureInboxIndexes } from '../../../utils/inbox/collections'
import { processEmailAttachments } from '../../../services/inboxProcessService'

export default defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections()
    await ensureInboxIndexes()

    const emailId = getRouterParam(event, 'emailId')
    if (!emailId) {
      throw createError({ statusCode: 400, statusMessage: 'Missing emailId' })
    }

    const data = await processEmailAttachments(emailId)
    return { success: true, data }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    const msg = error instanceof Error ? error.message : 'Failed to process email'
    if (msg === 'Email not found') {
      throw createError({ statusCode: 404, statusMessage: msg })
    }
    throw createError({ statusCode: 500, statusMessage: msg })
  }
})
