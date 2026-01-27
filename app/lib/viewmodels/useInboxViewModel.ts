/**
 * @registry-id: useInboxViewModel
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-27T12:00:00.000Z
 * @description: Inbox ViewModel - state management and business logic for inbox operations
 * @last-fix: [2026-01-27] Added watch subscription state management for Gmail push notifications
 * 
 * @imports-from:
 *   - app/lib/services/inboxService.ts => Inbox API operations
 *   - app/lib/viewmodels/base.ts => Base ViewModel utilities
 *   - app/lib/types/inbox.types.ts => Inbox types
 * 
 * @exports-to:
 *   ✓ app/components/InboxEmailList.tsx => Uses useInboxViewModel for list state
 *   ✓ app/daily-ops/inbox/** => Uses useInboxViewModel for inbox operations
 */

'use client'

import { useCallback, useState } from 'react'
import { inboxService } from '@/lib/services/inboxService'
import { useViewModelState } from './base'
import type {
  InboxEmail,
  InboxEmailFilters,
  EmailAttachment,
  ParsedData,
  InboxListResponse,
} from '@/lib/types/inbox.types'

export function useInboxViewModel() {
  const { state, setLoading, setError, setData } = useViewModelState<InboxEmail>()
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filters, setFilters] = useState<InboxEmailFilters>({ archived: false })
  const [watchStatus, setWatchStatus] = useState<{
    isWatching: boolean
    historyId?: string
    expiration?: string
  }>({ isWatching: false })

  const loadEmails = useCallback(
    async (page: number = 1, limit: number = 20, emailFilters?: InboxEmailFilters) => {
      setLoading(true)
      try {
        const activeFilters = emailFilters || filters
        const response = await inboxService.listEmails(page, limit, activeFilters)
        if (response.success && response.data) {
          setData(response.data.emails)
          setTotal(response.data.total)
          setHasMore(response.data.hasMore)
          setCurrentPage(page)
        } else {
          setError(response.error || 'Failed to load emails')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load emails')
      }
    },
    [setLoading, setError, setData, filters]
  )

  const getEmail = useCallback(
    async (id: string): Promise<InboxEmail & { attachments?: EmailAttachment[] } | null> => {
      setLoading(true)
      try {
        const response = await inboxService.getEmail(id)
        if (response.success && response.data) {
          return response.data
        } else {
          setError(response.error || 'Failed to load email')
          return null
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load email')
        return null
      }
    },
    [setLoading, setError]
  )

  const syncEmails = useCallback(
    async (options?: { maxResults?: number; query?: string }) => {
      setLoading(true)
      try {
        const response = await inboxService.syncEmails(options)
        if (response.success && response.data) {
          // Reload emails after sync
          await loadEmails(1, 20, filters)
          return response.data
        } else {
          setError(response.error || 'Failed to sync emails')
          return null
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to sync emails')
        return null
      }
    },
    [setLoading, setError, loadEmails, filters]
  )

  const processEmail = useCallback(
    async (emailId: string) => {
      setLoading(true)
      try {
        const response = await inboxService.processEmail(emailId)
        if (response.success && response.data) {
          // Reload email to get updated status
          await getEmail(emailId)
          return response.data
        } else {
          setError(response.error || 'Failed to process email')
          return null
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to process email')
        return null
      }
    },
    [setLoading, setError, getEmail]
  )

  const getUnprocessedCount = useCallback(async (): Promise<number> => {
    try {
      const response = await inboxService.getUnprocessedCount()
      if (response.success && response.data) {
        return response.data.count
      }
      return 0
    } catch {
      return 0
    }
  }, [])

  const updateFilters = useCallback((newFilters: InboxEmailFilters) => {
    setFilters(newFilters)
    loadEmails(1, 20, newFilters)
  }, [loadEmails])

  const startWatch = useCallback(
    async (options?: { topicName?: string; labelIds?: string[] }) => {
      setLoading(true)
      try {
        const response = await inboxService.startWatch(options)
        if (response.success && response.data) {
          setWatchStatus({
            isWatching: true,
            historyId: response.data.historyId,
            expiration: response.data.expiration,
          })
          return response.data
        } else {
          setError(response.error || 'Failed to start watch')
          return null
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to start watch')
        return null
      } finally {
        setLoading(false)
      }
    },
    [setLoading, setError]
  )

  const stopWatch = useCallback(async () => {
    setLoading(true)
    try {
      const response = await inboxService.stopWatch()
      if (response.success) {
        setWatchStatus({ isWatching: false })
        return true
      } else {
        setError(response.error || 'Failed to stop watch')
        return false
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to stop watch')
      return false
    } finally {
      setLoading(false)
    }
  }, [setLoading, setError])

  const getWatchStatus = useCallback(async () => {
    try {
      const response = await inboxService.getWatchStatus()
      if (response.success && response.data) {
        return response.data
      }
      return null
    } catch {
      return null
    }
  }, [])

  return {
    state,
    currentPage,
    total,
    hasMore,
    filters,
    watchStatus,
    loadEmails,
    getEmail,
    syncEmails,
    processEmail,
    getUnprocessedCount,
    updateFilters,
    startWatch,
    stopWatch,
    getWatchStatus,
    setLoading,
    setError,
  }
}
