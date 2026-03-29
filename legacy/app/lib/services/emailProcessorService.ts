/**
 * @registry-id: emailProcessorService
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Email processor service - processes fetched Gmail messages and extracts metadata
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/gmailApiService.ts => Gmail API client
 *   - app/lib/types/inbox.types.ts => Inbox types
 * 
 * @exports-to:
 *   ✓ app/api/inbox/sync/route.ts => Processes emails from Gmail API
 *   ✓ app/lib/services/inboxService.ts => Uses emailProcessorService for email extraction
 */

import { gmailApiService, type GmailMessage, type GmailAttachment } from './gmailApiService'
import type { CreateInboxEmailDto, CreateEmailAttachmentDto } from '@/lib/types/inbox.types'

export interface ProcessedEmail {
  email: CreateInboxEmailDto
  attachments: CreateEmailAttachmentDto[]
}

export interface ProcessEmailOptions {
  maxResults?: number
  query?: string
}

class EmailProcessorService {
  /**
   * Extract email address from Gmail payload headers
   */
  private extractEmailFromHeaders(headers: Array<{ name?: string; value?: string }>): string {
    const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from')
    if (!fromHeader?.value) {
      return 'unknown@unknown.com'
    }

    // Extract email from "Name <email@domain.com>" format
    const emailMatch = fromHeader.value.match(/<([^>]+)>/) || fromHeader.value.match(/(\S+@\S+)/)
    return emailMatch ? emailMatch[1] : fromHeader.value
  }

  /**
   * Extract subject from Gmail payload headers
   */
  private extractSubject(headers: Array<{ name?: string; value?: string }>): string {
    const subjectHeader = headers.find((h) => h.name?.toLowerCase() === 'subject')
    return subjectHeader?.value || '(No Subject)'
  }

  /**
   * Extract date from Gmail message
   */
  private extractDate(message: GmailMessage): Date {
    if (message.internalDate) {
      return new Date(parseInt(message.internalDate, 10))
    }
    return new Date()
  }

  /**
   * Extract attachments from Gmail message payload
   */
  private extractAttachments(
    message: GmailMessage,
    emailId: string
  ): Array<{ partId: string; filename: string; mimeType: string; size: number; attachmentId: string }> {
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

    if (message.payload) {
      processPart(message.payload)
    }

    return attachments
  }

  /**
   * Process Gmail messages and extract email data
   */
  async processEmails(options: ProcessEmailOptions = {}): Promise<ProcessedEmail[]> {
    try {
      const result = await gmailApiService.fetchEmails({
        maxResults: options.maxResults || 50,
        query: options.query,
      })

      const processedEmails: ProcessedEmail[] = []

      for (const message of result.messages) {
        try {
          const payload = message.payload
          if (!payload?.headers) {
            continue
          }

          const from = this.extractEmailFromHeaders(payload.headers)
          const subject = this.extractSubject(payload.headers)
          const receivedAt = this.extractDate(message)
          const summary = message.snippet || ''

          const attachments = this.extractAttachments(message, message.id)

          const email: CreateInboxEmailDto = {
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
          }

          const attachmentDtos: CreateEmailAttachmentDto[] = attachments.map((att) => ({
            emailId: '', // Will be set after email is created
            fileName: att.filename,
            mimeType: att.mimeType,
            fileSize: att.size,
            googleAttachmentId: att.attachmentId,
            metadata: {
              format: this.detectFormat(att.mimeType),
            },
          }))

          processedEmails.push({
            email,
            attachments: attachmentDtos,
          })
        } catch (error) {
          // Skip messages that fail to process
          continue
        }
      }

      return processedEmails
    } catch (error) {
      throw new Error(
        `Failed to process emails: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Detect file format from MIME type
   */
  private detectFormat(mimeType: string): 'csv' | 'xlsx' | 'pdf' | 'unknown' {
    if (mimeType.includes('csv') || mimeType === 'text/csv') {
      return 'csv'
    }
    if (
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      return 'xlsx'
    }
    if (mimeType.includes('pdf') || mimeType === 'application/pdf') {
      return 'pdf'
    }
    return 'unknown'
  }

  /**
   * Download attachment data from Gmail
   */
  async downloadAttachment(messageId: string, attachmentId: string): Promise<GmailAttachment> {
    return gmailApiService.downloadAttachment(messageId, attachmentId)
  }
}

export const emailProcessorService = new EmailProcessorService()
