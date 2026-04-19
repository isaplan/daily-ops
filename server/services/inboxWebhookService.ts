/**
 * @registry-id: inboxWebhookService
 * @created: 2026-04-18T00:00:00.000Z
 * @last-modified: 2026-04-18T00:00:00.000Z
 * @description: Gmail Pub/Sub push — decode notification, history.list (paged), persist new messages
 * @last-fix: [2026-04-18] Extracted from webhook.post; added getHistoryAll for multi-page history
 *
 * @exports-to:
 * ✓ server/api/inbox/webhook.post.ts
 *
 * Env (server): GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN (via gmailWatchService / gmailApiService)
 */

import { Buffer } from 'node:buffer'
import { gmailWatchService } from './gmailWatchService'
import { gmailApiService } from './gmailApiService'
import * as inboxRepo from './inboxRepository'

export type PubSubPushBody = {
  message: {
    data: string
    messageId: string
    publishTime: string
    attributes?: Record<string, string>
  }
  subscription: string
}

export type GmailPushNotification = {
  emailAddress: string
  historyId: string
}

export type InboxWebhookSuccess = {
  success: true
  data: {
    messageId: string
    historyId: string
    emailsCreated: number
    emailsFailed: number
  }
}

export type InboxWebhookFailure = {
  success: false
  statusCode: 400
  error: string
}

export type InboxWebhookResult = InboxWebhookSuccess | InboxWebhookFailure

function isPubSubPushBody(body: unknown): body is PubSubPushBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  const msg = b.message
  if (!msg || typeof msg !== 'object') return false
  const m = msg as Record<string, unknown>
  return typeof m.data === 'string' && typeof m.messageId === 'string'
}

export function parsePubSubPushBody(body: unknown): PubSubPushBody | null {
  return isPubSubPushBody(body) ? body : null
}

export function decodeGmailNotificationFromBase64(data: string): GmailPushNotification {
  const decoded = Buffer.from(data, 'base64').toString('utf-8')
  return JSON.parse(decoded) as GmailPushNotification
}

/** Gmail sends the *current* historyId; history.list returns records *after* startHistoryId, so use (n - 1). */
export function toStartHistoryId(currentHistoryId: string): string {
  const n = parseInt(currentHistoryId, 10)
  if (Number.isNaN(n) || n < 1) return currentHistoryId
  return String(n - 1)
}

async function processNewEmails(notificationHistoryId: string): Promise<{
  emailsCreated: number
  emailsFailed: number
}> {
  let emailsCreated = 0
  let emailsFailed = 0
  const startHistoryId = toStartHistoryId(notificationHistoryId)

  try {
    const historyRecords = await gmailWatchService.getHistoryAll(startHistoryId, 100)

    const messageIds = new Set<string>()
    for (const record of historyRecords) {
      if (record.messagesAdded) {
        for (const msg of record.messagesAdded) {
          if (msg.message.id) messageIds.add(msg.message.id)
        }
      }
      if (record.messages) {
        for (const msg of record.messages) {
          if (msg.id) messageIds.add(msg.id)
        }
      }
    }

    if (messageIds.size === 0) {
      return { emailsCreated: 0, emailsFailed: 0 }
    }

    for (const messageId of messageIds) {
      try {
        const existing = await inboxRepo.findEmailByMessageId(messageId)
        if (existing) continue

        const message = await gmailApiService.getMessage(messageId)
        if (!message) continue

        const payload = message.payload
        if (!payload?.headers) continue

        const fromHeader = payload.headers.find((h) => h.name?.toLowerCase() === 'from')
        const subjectHeader = payload.headers.find((h) => h.name?.toLowerCase() === 'subject')
        const from = fromHeader?.value
          ? fromHeader.value.match(/<([^>]+)>/)?.[1] ||
            fromHeader.value.match(/(\S+@\S+)/)?.[1] ||
            'unknown@unknown.com'
          : 'unknown@unknown.com'
        const subject = subjectHeader?.value || '(No Subject)'
        const receivedAt = message.internalDate
          ? new Date(parseInt(message.internalDate, 10))
          : new Date()
        const summary = message.snippet || ''

        const attachments: Array<{
          filename: string
          mimeType: string
          size: number
          attachmentId: string
        }> = []

        const processPart = (part: {
          filename?: string
          parts?: typeof part[]
          body?: { attachmentId?: string; size?: string }
          mimeType?: string
        }): void => {
          if (part.filename && part.body?.attachmentId) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType || 'application/octet-stream',
              size: parseInt(part.body.size || '0', 10),
              attachmentId: part.body.attachmentId,
            })
          }
          if (part.parts) part.parts.forEach((p) => processPart(p))
        }

        processPart(payload as Parameters<typeof processPart>[0])

        const { _id: emailId } = await inboxRepo.insertEmail({
          messageId: message.id,
          from,
          subject,
          receivedAt,
          summary: summary.substring(0, 500),
          hasAttachments: attachments.length > 0,
          attachmentCount: attachments.length,
          metadata: {
            labels: message.labelIds,
            threadId: message.threadId,
          },
        })

        for (const att of attachments) {
          const fmt = att.mimeType.includes('csv')
            ? 'csv'
            : att.mimeType.includes('spreadsheet') || att.mimeType.includes('excel')
              ? 'xlsx'
              : att.mimeType.includes('pdf')
                ? 'pdf'
                : 'unknown'
          await inboxRepo.insertAttachment(emailId, {
            emailId: String(emailId),
            fileName: att.filename,
            mimeType: att.mimeType,
            fileSize: att.size,
            googleAttachmentId: att.attachmentId,
            metadata: { format: fmt },
          })
        }

        await inboxRepo.insertProcessingLog({
          emailId: String(emailId),
          eventType: 'fetch',
          status: 'success',
          message: `Email fetched via webhook: ${subject}`,
        })

        emailsCreated++
      } catch {
        emailsFailed++
        await inboxRepo.insertProcessingLog({
          eventType: 'fetch',
          status: 'error',
          message: 'Failed to process email from webhook',
          details: { messageId },
        })
      }
    }
  } catch (error) {
    await inboxRepo.insertProcessingLog({
      eventType: 'fetch',
      status: 'error',
      message: `Failed to process Gmail history: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { notificationHistoryId, startHistoryId },
    })
  }

  return { emailsCreated, emailsFailed }
}

/**
 * Full Pub/Sub push flow: validate body, log receipt, fetch new messages via History API, persist.
 * Caller must call ensureInboxCollections / ensureInboxIndexes before this if collections may be missing.
 */
export async function handleInboxPubSubPush(rawBody: unknown): Promise<InboxWebhookResult> {
  const body = parsePubSubPushBody(rawBody)
  if (!body?.message?.data) {
    return { success: false, statusCode: 400, error: 'Invalid request body' }
  }

  let notification: GmailPushNotification
  try {
    notification = decodeGmailNotificationFromBase64(body.message.data)
  } catch {
    return { success: false, statusCode: 400, error: 'Invalid Pub/Sub message data' }
  }

  await inboxRepo.insertProcessingLog({
    eventType: 'fetch',
    status: 'success',
    message: `Webhook received from Gmail (historyId: ${notification.historyId})`,
    details: { historyId: notification.historyId, emailAddress: notification.emailAddress },
  })

  const result = await processNewEmails(notification.historyId)

  return {
    success: true,
    data: {
      messageId: body.message.messageId,
      historyId: notification.historyId,
      emailsCreated: result.emailsCreated,
      emailsFailed: result.emailsFailed,
    },
  }
}
