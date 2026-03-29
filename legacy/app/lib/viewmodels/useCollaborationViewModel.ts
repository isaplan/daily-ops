/**
 * @registry-id: useCollaborationViewModel
 * @created: 2026-01-16T15:45:00.000Z
 * @last-modified: 2026-01-16T15:45:00.000Z
 * @description: ViewModel for Collaboration dashboard (MVVM pattern)
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Collaboration dashboard
 * 
 * @imports-from:
 *   - app/lib/services/collaborationService.ts => collaborationService for API calls
 *   - app/lib/types/collaboration.types.ts => CollaborationDashboardData, CollaborationFilters types
 * 
 * @exports-to:
 *   ✓ app/components/collaboration/** => Components use useCollaborationViewModel
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { collaborationService } from '@/lib/services/collaborationService'
import type { CollaborationDashboardData, CollaborationFilters, CollaborationPagination } from '@/lib/types/collaboration.types'

interface UseCollaborationViewModelReturn {
  dashboardData: CollaborationDashboardData | null
  loading: boolean
  error: string | null
  loadDashboard: (filters?: CollaborationFilters, pagination?: CollaborationPagination) => Promise<void>
  refresh: () => Promise<void>
}

export function useCollaborationViewModel(
  initialFilters?: CollaborationFilters,
  initialPagination?: CollaborationPagination
): UseCollaborationViewModelReturn {
  const [dashboardData, setDashboardData] = useState<CollaborationDashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentFilters, setCurrentFilters] = useState<CollaborationFilters | undefined>(initialFilters)
  const [currentPagination, setCurrentPagination] = useState<CollaborationPagination | undefined>(
    initialPagination || { skip: 0, limit: 20 }
  )

  const loadDashboard = useCallback(
    async (filters?: CollaborationFilters, pagination?: CollaborationPagination) => {
      try {
        setLoading(true)
        setError(null)
        if (filters) {
          setCurrentFilters(filters)
        }
        if (pagination) {
          setCurrentPagination(pagination)
        }
        const response = await collaborationService.getDashboardData(
          filters || currentFilters,
          pagination || currentPagination
        )
        if (response.success && response.data) {
          setDashboardData(response.data)
        } else {
          setError(response.error || 'Failed to load dashboard data')
          setDashboardData(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        setDashboardData(null)
      } finally {
        setLoading(false)
      }
    },
    [currentFilters, currentPagination]
  )

  const refresh = useCallback(async () => {
    await loadDashboard(currentFilters, currentPagination)
  }, [loadDashboard, currentFilters, currentPagination])

  useEffect(() => {
    if (initialFilters || initialPagination) {
      loadDashboard(initialFilters, initialPagination)
    }
  }, [])

  return {
    dashboardData,
    loading,
    error,
    loadDashboard,
    refresh,
  }
}
