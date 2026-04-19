import { ensureInboxCollections, ensureInboxIndexes } from '../../utils/inbox/collections'
import * as inboxRepo from '../../services/inboxRepository'

export default defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections()
    await ensureInboxIndexes()

    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    }

    const result = await inboxRepo.getEmailWithAttachments(id)
    if (!result) {
      throw createError({ statusCode: 404, statusMessage: 'Email not found' })
    }

    return {
      success: true,
      data: {
        ...result.email,
        attachments: result.attachments,
      },
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to get email',
    })
  }
})
