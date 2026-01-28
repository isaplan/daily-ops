/**
 * @registry-id: inboxService
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-27T12:00:00.000Z
 * @description: Inbox API service - CRUD operations for emails, attachments, parsed data, and logs
 * @last-fix: [2026-01-27] Added watch subscription methods for Gmail push notifications
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 *   - app/lib/types/inbox.types.ts => Inbox types
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useInboxViewModel.ts => Uses inboxService for API calls
 *   ✓ app/api/inbox/** => API routes use inboxService
 */

import { ApiService, type ApiResponse } from './base'
import type {
  InboxEmail,
  CreateInboxEmailDto,
  UpdateInboxEmailDto,
  InboxEmailFilters,
  EmailAttachment,
  CreateEmailAttachmentDto,
  UpdateEmailAttachmentDto,
  ParsedData,
  CreateParsedDataDto,
  ProcessingLog,
  CreateProcessingLogDto,
  InboxListResponse,
} from '@/lib/types/inbox.types'

class InboxService extends ApiService {
  constructor() {
    super('/api')
  }

  // ========== Email Operations ==========

  /**
   * List emails with pagination and filters
   */
  async listEmails(
    page: number = 1,
    limit: number = 20,
    filters?: InboxEmailFilters
  ): Promise<ApiResponse<InboxListResponse>> {
    const params = new URLSearchParams()
    params.append('page', String(page))
    params.append('limit', String(limit))

    if (filters?.status) params.append('status', filters.status)
    if (filters?.from) params.append('from', filters.from)
    if (filters?.documentType) params.append('documentType', filters.documentType)
    if (filters?.archived !== undefined) params.append('archived', String(filters.archived))
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom.toISOString())
    if (filters?.dateTo) params.append('dateTo', filters.dateTo.toISOString())

    return this.get<InboxListResponse>(`/inbox/list?${params.toString()}`)
  }

  /**
   * Get email by ID
   */
  async getEmail(id: string): Promise<ApiResponse<InboxEmail & { attachments?: EmailAttachment[] }>> {
    return this.get<InboxEmail & { attachments?: EmailAttachment[] }>(`/inbox/${id}`)
  }

  /**
   * Create email
   */
  async createEmail(data: CreateInboxEmailDto): Promise<ApiResponse<InboxEmail>> {
    return this.post<InboxEmail>('/inbox/emails', data)
  }

  /**
   * Update email
   */
  async updateEmail(id: string, data: UpdateInboxEmailDto): Promise<ApiResponse<InboxEmail>> {
    return this.patch<InboxEmail>(`/inbox/emails/${id}`, data)
  }

  /**
   * Get unprocessed email count
   */
  async getUnprocessedCount(): Promise<ApiResponse<{ count: number }>> {
    return this.get<{ count: number }>('/inbox/unprocessed-count')
  }

  // ========== Attachment Operations ==========

  /**
   * Get attachment by ID
   */
  async getAttachment(id: string): Promise<ApiResponse<EmailAttachment & { parsedData?: ParsedData }>> {
    return this.get<EmailAttachment & { parsedData?: ParsedData }>(`/inbox/attachments/${id}`)
  }

  /**
   * Create attachment
   */
  async createAttachment(data: CreateEmailAttachmentDto): Promise<ApiResponse<EmailAttachment>> {
    return this.post<EmailAttachment>('/inbox/attachments', data)
  }

  /**
   * Update attachment
   */
  async updateAttachment(
    id: string,
    data: UpdateEmailAttachmentDto
  ): Promise<ApiResponse<EmailAttachment>> {
    return this.patch<EmailAttachment>(`/inbox/attachments/${id}`, data)
  }

  // ========== Parsed Data Operations ==========

  /**
   * Get parsed data by ID
   */
  async getParsedData(id: string): Promise<ApiResponse<ParsedData>> {
    return this.get<ParsedData>(`/inbox/parsed-data/${id}`)
  }

  /**
   * Create parsed data
   */
  async createParsedData(data: CreateParsedDataDto): Promise<ApiResponse<ParsedData>> {
    return this.post<ParsedData>('/inbox/parsed-data', data)
  }

  // ========== Processing Log Operations ==========

  /**
   * Get processing logs for email
   */
  async getEmailLogs(emailId: string): Promise<ApiResponse<ProcessingLog[]>> {
    return this.get<ProcessingLog[]>(`/inbox/logs/email/${emailId}`)
  }

  /**
   * Get processing logs for attachment
   */
  async getAttachmentLogs(attachmentId: string): Promise<ApiResponse<ProcessingLog[]>> {
    return this.get<ProcessingLog[]>(`/inbox/logs/attachment/${attachmentId}`)
  }

  /**
   * Create processing log
   */
  async createLog(data: CreateProcessingLogDto): Promise<ApiResponse<ProcessingLog>> {
    return this.post<ProcessingLog>('/inbox/logs', data)
  }

  // ========== Sync Operations ==========

  /**
   * Trigger email sync from Gmail
   */
  async syncEmails(options?: { maxResults?: number; query?: string }): Promise<ApiResponse<{
    emailsCreated: number
    emailsFailed: number
    total: number
  }>> {
    return this.post<{
      emailsCreated: number
      emailsFailed: number
      total: number
    }>('/inbox/sync', options)
  }

  /**
   * Process email (parse attachments)
   */
  async processEmail(emailId: string): Promise<ApiResponse<{
    success: boolean
    attachmentsProcessed: number
    attachmentsFailed: number
  }>> {
    return this.post<{
      success: boolean
      attachmentsProcessed: number
      attachmentsFailed: number
    }>(`/inbox/process/${emailId}`)
  }

  /**
   * Process all unprocessed emails (batch process)
   */
  async processAll(options?: { maxEmails?: number }): Promise<ApiResponse<{
    emailsProcessed: number
    emailsFailed: number
    total: number
    results: Array<{ emailId: string; success: boolean; attachmentsProcessed: number; error?: string }>
  }>> {
    return this.post<{
      emailsProcessed: number
      emailsFailed: number
      total: number
      results: Array<{ emailId: string; success: boolean; attachmentsProcessed: number; error?: string }>
    }>('/inbox/process-all', options)
  }

  /**
   * Process all unprocessed emails (batch process)
   */
  async processAll(options?: { maxEmails?: number }): Promise<ApiResponse<{
    emailsProcessed: number
    emailsFailed: number
    total: number
    results: Array<{ emailId: string; success: boolean; attachmentsProcessed: number; error?: string }>
  }>> {
    return this.post<{
      emailsProcessed: number
      emailsFailed: number
      total: number
      results: Array<{ emailId: string; success: boolean; attachmentsProcessed: number; error?: string }>
    }>('/inbox/process-all', options)
  }

  // ========== Watch Operations ==========

  /**
   * Start watching for Gmail inbox changes (push notifications)
   */
  async startWatch(options?: { topicName?: string; labelIds?: string[] }): Promise<ApiResponse<{
    historyId: string
    expiration: string
    topicName: string
  }>> {
    return this.post<{
      historyId: string
      expiration: string
      topicName: string
    }>('/inbox/watch', options)
  }

  /**
   * Stop watching for Gmail inbox changes
   */
  async stopWatch(): Promise<ApiResponse<{ message: string }>> {
    return this.delete<{ message: string }>('/inbox/watch')
  }

  /**
   * Get current watch status
   */
  async getWatchStatus(): Promise<ApiResponse<{ message: string }>> {
    return this.get<{ message: string }>('/inbox/watch')
  }
}

export const inboxService = new InboxService()
