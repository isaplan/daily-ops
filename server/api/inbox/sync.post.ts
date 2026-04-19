import { ensureInboxCollections, ensureInboxIndexes } from '../../utils/inbox/collections'
import { emailProcessorService } from '../../services/emailProcessorService'
import * as inboxRepo from '../../services/inboxRepository'

export default defineEventHandler(async (event) => {
  try {
    await ensureInboxCollections()
    await ensureInboxIndexes()

    const body = await readBody(event).catch(() => ({})) as { maxResults?: number; query?: string }
    const maxResults = body.maxResults ?? 50
    const query = body.query

    const processedEmails = await emailProcessorService.processEmails({
      maxResults,
      query,
    })

    let emailsCreated = 0
    let emailsFailed = 0

    for (const processed of processedEmails) {
      try {
        const existing = await inboxRepo.findEmailByMessageId(processed.email.messageId)
        if (existing) {
          continue
        }

        const { _id: emailId } = await inboxRepo.insertEmail(processed.email)

        for (const attachmentDto of processed.attachments) {
          await inboxRepo.insertAttachment(emailId, {
            ...attachmentDto,
            emailId: String(emailId),
          })
        }

        await inboxRepo.insertProcessingLog({
          emailId: String(emailId),
          eventType: 'fetch',
          status: 'success',
          message: `Email fetched and stored: ${processed.email.subject}`,
        })

        emailsCreated++
      } catch {
        emailsFailed++
        await inboxRepo.insertProcessingLog({
          eventType: 'fetch',
          status: 'error',
          message: 'Failed to store email',
          details: { email: processed.email },
        })
      }
    }

    return {
      success: true,
      data: {
        emailsCreated,
        emailsFailed,
        total: processedEmails.length,
      },
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to sync emails',
    })
  }
})
