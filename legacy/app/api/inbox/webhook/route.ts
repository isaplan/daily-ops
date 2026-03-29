/**
 * @registry-id: inboxWebhookAPI
 * @created: 2026-01-27T12:00:00.000Z
 * @last-modified: 2026-02-02T12:00:00.000Z
 * @description: Inbox webhook API - receives Pub/Sub push notifications from Gmail
 * @last-fix: [2026-02-02] Fixed historyId: use startHistoryId so history.list returns new messages; log webhook receipt
 * 
 * @imports-from:
 *   - app/lib/services/gmailWatchService.ts => Gmail watch service
 *   - app/lib/services/emailProcessorService.ts => Email processing
 *   - app/lib/services/inboxService.ts => Inbox CRUD operations
 *   - app/lib/mongodb/inbox-collections.ts => Collection initialization
 * 
 * @exports-to:
 *   ✓ Google Cloud Pub/Sub => Sends push notifications to this endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { gmailWatchService } from '@/lib/services/gmailWatchService'
import { emailProcessorService } from '@/lib/services/emailProcessorService'
import { ensureInboxCollections } from '@/lib/mongodb/inbox-collections'
import InboxEmail from '@/models/InboxEmail'
import EmailAttachment from '@/models/EmailAttachment'
import ProcessingLog from '@/models/ProcessingLog'
import dbConnect from '@/lib/mongodb'

interface PubSubMessage {
  message: {
    data: string
    messageId: string
    publishTime: string
    attributes?: Record<string, string>
  }
  subscription: string
}

interface GmailNotification {
  emailAddress: string
  historyId: string
}

/**
 * Verify Pub/Sub message signature (optional but recommended for production)
 */
function verifyMessageSignature(message: PubSubMessage): boolean {
  // In production, verify the message signature using Google's public keys
  // For now, we'll accept all messages (you can add verification later)
  return true
}

/**
 * Decode base64 Pub/Sub message data
 */
function decodeMessageData(data: string): GmailNotification {
  try {
    const decoded = Buffer.from(data, 'base64').toString('utf-8')
    return JSON.parse(decoded) as GmailNotification
  } catch (error) {
    throw new Error(`Failed to decode message data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Gmail push sends the *current* historyId (after the change). history.list returns
 * records *after* startHistoryId, so we must use (currentHistoryId - 1) to include the change.
 */
function toStartHistoryId(currentHistoryId: string): string {
  const n = parseInt(currentHistoryId, 10)
  if (Number.isNaN(n) || n < 1) return currentHistoryId
  return String(n - 1)
}

/**
 * Process new emails from Gmail history
 */
async function processNewEmails(notificationHistoryId: string): Promise<{
  emailsCreated: number
  emailsFailed: number
}> {
  let emailsCreated = 0
  let emailsFailed = 0
  const startHistoryId = toStartHistoryId(notificationHistoryId)

  try {
    const historyRecords = await gmailWatchService.getHistory(startHistoryId, 100)

    // Extract unique message IDs from history
    const messageIds = new Set<string>()
    for (const record of historyRecords) {
      if (record.messagesAdded) {
        for (const msg of record.messagesAdded) {
          if (msg.message.id) {
            messageIds.add(msg.message.id)
          }
        }
      }
      if (record.messages) {
        for (const msg of record.messages) {
          if (msg.id) {
            messageIds.add(msg.id)
          }
        }
      }
    }

    if (messageIds.size === 0) {
      return { emailsCreated: 0, emailsFailed: 0 }
    }

    // Process each new message
    const { gmailApiService } = await import('@/lib/services/gmailApiService')
    
    for (const messageId of messageIds) {
      try {
        // Check if email already exists
        const existing = await InboxEmail.findOne({ messageId })
        if (existing) {
          continue // Skip duplicates
        }

        // Fetch full message from Gmail
        const message = await gmailApiService.getMessage(messageId)
        if (!message) {
          continue
        }

        // Process email (extract metadata, attachments, etc.)
        const payload = message.payload
        if (!payload?.headers) {
          continue
        }

        // Extract email data
        const fromHeader = payload.headers.find((h) => h.name?.toLowerCase() === 'from')
        const subjectHeader = payload.headers.find((h) => h.name?.toLowerCase() === 'subject')
        const from = fromHeader?.value
          ? fromHeader.value.match(/<([^>]+)>/)?.[1] || fromHeader.value.match(/(\S+@\S+)/)?.[1] || 'unknown@unknown.com'
          : 'unknown@unknown.com'
        const subject = subjectHeader?.value || '(No Subject)'
        const receivedAt = message.internalDate
          ? new Date(parseInt(message.internalDate, 10))
          : new Date()
        const summary = message.snippet || ''

        // Extract attachments
        const attachments: Array<{
          partId: string
          filename: string
          mimeType: string
          size: number
          attachmentId: string
        }> = []

        const processPart = (part: any): void => {
          if (part.filename && part.body?.attachmentId) {
            attachments.push({
              partId: part.partId || '',
              filename: part.filename,
              mimeType: part.mimeType || 'application/octet-stream',
              size: parseInt(part.body.size || '0', 10),
              attachmentId: part.body.attachmentId,
            })
          }
          if (part.parts) {
            part.parts.forEach((p: any) => processPart(p))
          }
        }

        if (payload) {
          processPart(payload)
        }

        // Create email record
        const email = await InboxEmail.create({
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

        // Create attachments
        for (const att of attachments) {
          await EmailAttachment.create({
            emailId: email._id,
            fileName: att.filename,
            mimeType: att.mimeType,
            fileSize: att.size,
            googleAttachmentId: att.attachmentId,
            metadata: {
              format: att.mimeType.includes('csv')
                ? 'csv'
                : att.mimeType.includes('spreadsheet') || att.mimeType.includes('excel')
                  ? 'xlsx'
                  : att.mimeType.includes('pdf')
                    ? 'pdf'
                    : 'unknown',
            },
          })
        }

        // Log success
        await ProcessingLog.create({
          emailId: email._id,
          eventType: 'fetch',
          status: 'success',
          message: `Email fetched via webhook: ${subject}`,
        })

        emailsCreated++
      } catch (error) {
        emailsFailed++

        // Log error
        await ProcessingLog.create({
          eventType: 'fetch',
          status: 'error',
          message: `Failed to process email from webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { messageId },
        })
      }
    }
  } catch (error) {
    await ProcessingLog.create({
      eventType: 'fetch',
      status: 'error',
      message: `Failed to process Gmail history: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { notificationHistoryId, startHistoryId },
    })
  }

  return { emailsCreated, emailsFailed }
}

/**
 * POST /api/inbox/webhook
 * Receives Pub/Sub push notifications from Gmail
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    await ensureInboxCollections()

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Handle Pub/Sub message format
    const message: PubSubMessage = body

    // Verify message signature (optional but recommended)
    if (!verifyMessageSignature(message)) {
      return NextResponse.json(
        { success: false, error: 'Invalid message signature' },
        { status: 401 }
      )
    }

    // Decode message data
    const notification = decodeMessageData(message.message.data)

    // Log webhook receipt so verify-webhook-setup sees activity (even when 0 emails created)
    await ProcessingLog.create({
      eventType: 'fetch',
      status: 'success',
      message: `Webhook received from Gmail (historyId: ${notification.historyId})`,
      details: { historyId: notification.historyId, emailAddress: notification.emailAddress },
    })

    // Process new emails (use notification historyId; we request history *after* (historyId - 1) inside processNewEmails)
    const result = await processNewEmails(notification.historyId)

    // Return 200 to acknowledge receipt
    return NextResponse.json({
      success: true,
      data: {
        messageId: message.message.messageId,
        historyId: notification.historyId,
        emailsCreated: result.emailsCreated,
        emailsFailed: result.emailsFailed,
      },
    })
  } catch (error) {
    // Always return 200 to prevent Pub/Sub retries for processing errors
    // Log the error for debugging
    console.error('Webhook processing error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process webhook',
      },
      { status: 200 } // Return 200 to acknowledge receipt even on error
    )
  }
}
