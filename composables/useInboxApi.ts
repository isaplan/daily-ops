/**
 * @registry-id: useInboxApi
 * @created: 2026-04-18T00:00:00.000Z
 * @last-modified: 2026-04-23T18:00:00.000Z
 * @description: Typed client helpers for /api/inbox Nitro routes
 * @last-fix: [2026-04-23] InboxImportTableApiResponse alias; dedicated /api/inbox/eitje|bork|power-bi routes for import tables
 *
 * @exports-to:
 * ✓ pages/daily-ops/inbox (all pages)
 */

import type { InboxEmailFilters, InboxListResponse } from '~/types/inbox'

export type TestDataType =
  | 'sales'
  | 'product_mix'
  | 'food_beverage'
  | 'basis_report'
  | 'product_sales_per_hour'
  | 'hours'
  | 'contracts'
  | 'finance'
  | 'bi'

export type InboxImportTableApiResponse = {
  success: boolean
  data: {
    type: string
    /** attachment = exact CSV rows from parseddatas (Eitje default); mapped = inbox-eitje-*; collection = inbox-bork-* etc. */
    viewMode?: 'attachment' | 'mapped' | 'collection'
    collectionName: string
    mongoDatabase: string
    parsedImportCount: number
    rows: Record<string, unknown>[]
    columns: string[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasMore: boolean
    }
  }
}

/** @deprecated Use InboxImportTableApiResponse */
export type TestDataResponse = InboxImportTableApiResponse

export function useInboxApi() {
  const listEmails = async (page: number, limit: number, filters?: InboxEmailFilters) => {
    const q: Record<string, string> = {
      page: String(page),
      limit: String(limit),
    }
    if (filters?.status) q.status = filters.status
    if (filters?.from) q.from = filters.from
    if (filters?.archived !== undefined) q.archived = String(filters.archived)
    if (filters?.dateFrom) q.dateFrom = filters.dateFrom.toISOString()
    if (filters?.dateTo) q.dateTo = filters.dateTo.toISOString()

    return await $fetch<{ success: boolean; data: InboxListResponse }>('/api/inbox/list', { query: q })
  }

  const getEmail = async (id: string) => {
    return await $fetch<{
      success: boolean
      data: Record<string, unknown> & { attachments?: unknown[] }
    }>(`/api/inbox/${id}`)
  }

  const getUnprocessedCount = async () => {
    return await $fetch<{ success: boolean; data: { count: number } }>('/api/inbox/unprocessed-count')
  }

  const syncEmails = async (body?: { maxResults?: number; query?: string }) => {
    return await $fetch<{
      success: boolean
      data: { emailsCreated: number; emailsFailed: number; total: number }
    }>('/api/inbox/sync', { method: 'POST', body: body ?? {} })
  }

  const processEmail = async (emailId: string) => {
    return await $fetch<{
      success: boolean
      data: { success: boolean; attachmentsProcessed: number; attachmentsFailed: number }
    }>(`/api/inbox/process/${emailId}`, { method: 'POST' })
  }

  const processAll = async (body?: { maxEmails?: number }) => {
    return await $fetch<{
      success: boolean
      data: {
        emailsProcessed: number
        emailsFailed: number
        total: number
        message: string
        results: Array<{ emailId: string; success: boolean; attachmentsProcessed: number; error?: string }>
      }
    }>('/api/inbox/process-all', { method: 'POST', body: body ?? {} })
  }

  const uploadFile = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return await $fetch('/api/inbox/upload', { method: 'POST', body: form })
  }

  const parsePreview = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return await $fetch('/api/inbox/parse', { method: 'POST', body: form })
  }

  const startWatch = async (body?: { topicName?: string; labelIds?: string[] }) => {
    return await $fetch<{
      success: boolean
      data: { historyId: string; expiration: string; topicName: string }
    }>('/api/inbox/watch', { method: 'POST', body: body ?? {} })
  }

  const stopWatch = async () => {
    return await $fetch<{ success: boolean; data: { message: string } }>('/api/inbox/watch', {
      method: 'DELETE',
    })
  }

  const getWatchStatus = async () => {
    return await $fetch<{
      success: boolean
      data: {
        isActive: boolean
        topicName: string | null
        watchExpiration: string | null
        lastHistoryId: string | null
        lastRenewalAt: string | null
        lastSyncOk: boolean
        lastSyncMessage: string | null
        hint: string
      }
    }>('/api/inbox/watch')
  }

  /** Legacy — prefer $fetch on /api/inbox/eitje/*, /api/inbox/bork/*, /api/inbox/power-bi/reports */
  const fetchTestData = async (type: TestDataType, page = 1, limit = 50, view?: 'attachment' | 'mapped') => {
    const query: Record<string, string> = { page: String(page), limit: String(limit) }
    if (view) query.view = view
    return await $fetch<InboxImportTableApiResponse>(`/api/inbox/test-data/${type}`, { query })
  }

  return {
    listEmails,
    getEmail,
    getUnprocessedCount,
    syncEmails,
    processEmail,
    processAll,
    uploadFile,
    parsePreview,
    startWatch,
    stopWatch,
    getWatchStatus,
    fetchTestData,
  }
}
