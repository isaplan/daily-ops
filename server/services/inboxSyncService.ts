/**
 * @registry-id: inboxSyncService
 * @created: 2026-04-20T00:00:00.000Z
 * @last-modified: 2026-04-20T00:00:00.000Z
 * @description: Gmail list fetch + store + auto-parse (shared by POST /api/inbox/sync and scheduled GET)
 * @last-fix: [2026-04-20] Extracted from sync.post for cron + UI reuse
 *
 * @exports-to:
 * ✓ server/api/inbox/sync.post.ts
 * ✓ server/api/inbox/sync-scheduled.get.ts
 * ✓ server/tasks/inbox/gmail-sync.ts
 */

import { ensureInboxCollections, ensureInboxIndexes } from '../utils/inbox/collections'
import { emailProcessorService } from './emailProcessorService'
import { processEmailAttachments } from './inboxProcessService'
import * as inboxRepo from './inboxRepository'

export type InboxSyncResult = {
  success: true
  data: {
    emailsCreated: number
    emailsFailed: number
    total: number
  }
}

export async function runInboxGmailSync(options: {
  maxResults?: number
  query?: string
}): Promise<InboxSyncResult> {
  await ensureInboxCollections()
  await ensureInboxIndexes()

  const maxResults = options.maxResults ?? 50
  const query = options.query

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

      try {
        const proc = await processEmailAttachments(String(emailId))
        await inboxRepo.insertProcessingLog({
          emailId: String(emailId),
          eventType: 'parse',
          status: proc.success ? 'success' : 'warning',
          message: `Auto-process after sync: ${proc.attachmentsProcessed} attachment(s) ok, ${proc.attachmentsFailed} failed`,
        })
      } catch (procErr) {
        await inboxRepo.insertProcessingLog({
          emailId: String(emailId),
          eventType: 'parse',
          status: 'error',
          message: `Auto-process after sync failed: ${procErr instanceof Error ? procErr.message : 'unknown'}`,
        })
      }

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
}
