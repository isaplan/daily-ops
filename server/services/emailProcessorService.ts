/**
 * @registry-id: emailProcessorService
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-04-18T00:00:00.000Z
 * @description: Maps Gmail messages to CreateInboxEmailDto + attachment DTOs (Nuxt port)
 * @last-fix: [2026-04-18] Ported from next-js-old
 *
 * @exports-to:
 * ✓ server/api/inbox/sync.post.ts
 */

import { gmailApiService, type GmailMessage, type GmailAttachment } from './gmailApiService'
import type { CreateInboxEmailDto, CreateEmailAttachmentDto } from '~/types/inbox'

export type ProcessedEmail = {
  email: CreateInboxEmailDto
  attachments: CreateEmailAttachmentDto[]
}

export type ProcessEmailOptions = {
  maxResults?: number
  query?: string
}

class EmailProcessorService {
  private extractEmailFromHeaders(headers: Array<{ name?: string; value?: string }>): string {
    const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from')
    if (!fromHeader?.value) {
      return 'unknown@unknown.com'
    }
    const emailMatch = fromHeader.value.match(/<([^>]+)>/) || fromHeader.value.match(/(\S+@\S+)/)
    return emailMatch ? emailMatch[1] : fromHeader.value
  }

  private extractSubject(headers: Array<{ name?: string; value?: string }>): string {
    const subjectHeader = headers.find((h) => h.name?.toLowerCase() === 'subject')
    return subjectHeader?.value || '(No Subject)'
  }

  private extractDate(message: GmailMessage): Date {
    if (message.internalDate) {
      return new Date(parseInt(message.internalDate, 10))
    }
    return new Date()
  }

  private extractAttachments(message: GmailMessage): Array<{
    partId: string
    filename: string
    mimeType: string
    size: number
    attachmentId: string
  }> {
    const attachments: Array<{
      partId: string
      filename: string
      mimeType: string
      size: number
      attachmentId: string
    }> = []

    const processPart = (part: {
      filename?: string
      parts?: typeof part[]
      body?: { attachmentId?: string; size?: string }
      partId?: string
      mimeType?: string
    }): void => {
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
        part.parts.forEach((p) => processPart(p))
      }
    }

    if (message.payload) {
      processPart(message.payload as Parameters<typeof processPart>[0])
    }

    return attachments
  }

  async processEmails(options: ProcessEmailOptions = {}): Promise<ProcessedEmail[]> {
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

        const attachments = this.extractAttachments(message)

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
          emailId: '',
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
      } catch {
        continue
      }
    }

    return processedEmails
  }

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

  async downloadAttachment(messageId: string, attachmentId: string): Promise<GmailAttachment> {
    return gmailApiService.downloadAttachment(messageId, attachmentId)
  }
}

export const emailProcessorService = new EmailProcessorService()
