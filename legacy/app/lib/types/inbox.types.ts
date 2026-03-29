/**
 * @registry-id: inboxTypes
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-27T00:00:00.000Z
 * @description: Inbox type definitions - DTOs, filters, form data, enums
 * @last-fix: [2026-01-27] Added new document types: product_mix, food_beverage, basis_report, product_sales_per_hour
 * 
 * @exports-to:
 *   ✓ app/lib/services/inboxService.ts => Uses Inbox types
 *   ✓ app/lib/viewmodels/useInboxViewModel.ts => Uses Inbox types
 *   ✓ app/models/InboxEmail.ts => Uses Inbox types
 *   ✓ app/models/EmailAttachment.ts => Uses Inbox types
 *   ✓ app/models/ParsedData.ts => Uses Inbox types
 *   ✓ app/api/inbox/** => Uses Inbox types
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

export interface InboxEmail {
  _id: string
  messageId: string
  from: string
  subject: string
  receivedAt: Date
  storedAt: Date
  status: EmailStatus
  hasAttachments: boolean
  attachmentCount: number
  summary?: string
  errorMessage?: string
  processedAt?: Date
  lastAttempt?: Date
  retryCount: number
  archived: boolean
  archivedAt?: Date
  metadata: {
    labels?: string[]
    threadId?: string
  }
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

export interface EmailAttachment {
  _id: string
  emailId: string
  fileName: string
  mimeType: string
  fileSize: number
  googleAttachmentId: string
  downloadedAt: Date
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
}

export interface ParsedData {
  _id: string
  attachmentId: string
  emailId: string
  documentType: DocumentType
  extractedAt: Date
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

export interface ProcessingLog {
  _id: string
  emailId?: string
  attachmentId?: string
  eventType: EventType
  status: LogStatus
  message: string
  timestamp: Date
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
  emails: InboxEmail[]
  total: number
  hasMore: boolean
  page: number
  limit: number
}

export interface ParseResult {
  success: boolean
  format: FileFormat
  headers: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  error?: string
  metadata?: {
    sheets?: string[]
    delimiter?: string
    userInfo?: Record<string, unknown>
  }
}
