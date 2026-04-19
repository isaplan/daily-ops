/**
 * @registry-id: inboxTypes
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-04-18T00:00:00.000Z
 * @description: Inbox type definitions - DTOs, filters, form data (ported from next-js-old)
 * @last-fix: [2026-04-18] Nuxt port — updated @exports-to for server + pages
 *
 * @exports-to:
 * ✓ server/services/inboxRepository.ts
 * ✓ server/services/documentParserService.ts
 * ✓ server/api/inbox/**.ts
 * ✓ pages/daily-ops/inbox/**.vue
 */

export type EmailStatus = 'received' | 'processing' | 'completed' | 'failed'

export type ParseStatus = 'pending' | 'parsing' | 'success' | 'failed'

export type DocumentType =
  | 'hours'
  | 'contracts'
  | 'finance'
  | 'sales'
  | 'payroll'
  | 'bi'
  | 'other'
  | 'formitabele'
  | 'pasy'
  | 'coming_soon'
  | 'product_mix'
  | 'food_beverage'
  | 'basis_report'
  | 'product_sales_per_hour'

export type EventType = 'fetch' | 'parse' | 'validate' | 'store' | 'error'

export type LogStatus = 'success' | 'warning' | 'error'

export type FileFormat = 'csv' | 'xlsx' | 'pdf' | 'unknown'

export type InboxEmailDoc = {
  _id: string
  messageId: string
  from: string
  subject: string
  receivedAt: string
  storedAt: string
  status: EmailStatus
  hasAttachments: boolean
  attachmentCount: number
  summary?: string
  errorMessage?: string
  processedAt?: string
  lastAttempt?: string
  retryCount: number
  archived: boolean
  archivedAt?: string
  metadata: {
    labels?: string[]
    threadId?: string
  }
  attachmentStats?: { total: number; parsed: number }
}

export interface CreateInboxEmailDto {
  messageId: string
  from: string
  subject: string
  receivedAt: Date
  summary?: string
  hasAttachments: boolean
  attachmentCount: number
  metadata?: {
    labels?: string[]
    threadId?: string
  }
}

export interface UpdateInboxEmailDto {
  status?: EmailStatus
  errorMessage?: string
  processedAt?: Date
  lastAttempt?: Date
  retryCount?: number
  archived?: boolean
  archivedAt?: Date
}

export interface InboxEmailFilters {
  status?: EmailStatus
  from?: string
  documentType?: DocumentType
  archived?: boolean
  dateFrom?: Date
  dateTo?: Date
}

export type EmailAttachmentDoc = {
  _id: string
  emailId: string
  fileName: string
  mimeType: string
  fileSize: number
  googleAttachmentId: string
  downloadedAt: string
  storedLocally: boolean
  documentType: DocumentType
  parseStatus: ParseStatus
  parseError?: string
  parsedDataRef?: string
  metadata: {
    format: FileFormat
    sheets?: string[]
    rowCount?: number
    columnCount?: number
    userInfo?: Record<string, unknown>
    delimiter?: string
  }
  originalData?: string
}

export interface CreateEmailAttachmentDto {
  emailId: string
  fileName: string
  mimeType: string
  fileSize: number
  googleAttachmentId: string
  documentType?: DocumentType
  metadata?: {
    format?: FileFormat
    sheets?: string[]
    delimiter?: string
  }
  originalData?: string
}

export interface UpdateEmailAttachmentDto {
  parseStatus?: ParseStatus
  parseError?: string
  parsedDataRef?: string
  documentType?: DocumentType
  metadata?: {
    format?: FileFormat
    sheets?: string[]
    rowCount?: number
    columnCount?: number
    userInfo?: Record<string, unknown>
    delimiter?: string
  }
  originalData?: string
}

export type ParsedDataDoc = {
  _id: string
  attachmentId: string
  emailId: string
  documentType: DocumentType
  extractedAt: string
  format: FileFormat
  rowsProcessed: number
  rowsValid: number
  rowsFailed: number
  data: {
    headers: string[]
    rows: Record<string, unknown>[]
    metadata?: Record<string, unknown>
  }
  mapping: {
    mappedToCollection?: string
    matchedRecords?: number
    createdRecords?: number
    updatedRecords?: number
  }
  validationErrors?: Array<{
    row: number
    column: string
    error: string
  }>
}

export interface CreateParsedDataDto {
  attachmentId: string
  emailId: string
  documentType: DocumentType
  format: FileFormat
  rowsProcessed: number
  rowsValid: number
  rowsFailed: number
  data: {
    headers: string[]
    rows: Record<string, unknown>[]
    metadata?: Record<string, unknown>
  }
  mapping?: {
    mappedToCollection?: string
    matchedRecords?: number
    createdRecords?: number
    updatedRecords?: number
  }
  validationErrors?: Array<{
    row: number
    column: string
    error: string
  }>
}

export type ProcessingLogDoc = {
  _id: string
  emailId?: string
  attachmentId?: string
  eventType: EventType
  status: LogStatus
  message: string
  timestamp: string
  duration?: number
  details?: Record<string, unknown>
}

export interface CreateProcessingLogDto {
  emailId?: string
  attachmentId?: string
  eventType: EventType
  status: LogStatus
  message: string
  duration?: number
  details?: Record<string, unknown>
}

export interface InboxListResponse {
  emails: InboxEmailDoc[]
  total: number
  hasMore: boolean
  page: number
  limit: number
}

export interface ParseResult {
  success: boolean
  format: FileFormat | 'html' | 'html'
  headers: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  error?: string
  metadata?: {
    sheets?: string[]
    delimiter?: string
    userInfo?: Record<string, unknown>
    pageCount?: number
    extractedText?: string
  }
}
