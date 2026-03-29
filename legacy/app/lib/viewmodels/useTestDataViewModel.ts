/**
 * @registry-id: useTestDataViewModel
 * @created: 2026-01-27T00:00:00.000Z
 * @last-modified: 2026-01-27T00:00:00.000Z
 * @description: Test Data ViewModel - state management and business logic for test data operations
 * @last-fix: [2026-01-27] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/viewmodels/base.ts => Base ViewModel utilities
 * 
 * @exports-to:
 *   ✓ app/components/test-data/** => Uses useTestDataViewModel for test data state
 *   ✓ app/daily-ops/inbox/test-data/page.tsx => Uses useTestDataViewModel
 */

'use client'

import { useCallback, useState } from 'react'
import { useViewModelState } from './base'

export type TestDataType = 'sales' | 'product_mix' | 'food_beverage' | 'basis_report' | 'product_sales_per_hour' | 'hours' | 'contracts' | 'finance' | 'bi'

export interface TestDataRow {
  [key: string]: unknown
  _id: string
  sourceEmailId: string
  sourceAttachmentId: string
  sourceFileName: string
  fileFormat: 'csv' | 'xlsx' | 'pdf' | 'html'
  parsedAt: string
  created_at: string
  updated_at: string
}

export interface TestDataResponse {
  success: boolean
  data?: {
    type: TestDataType
    collectionName: string
    rows: TestDataRow[]
    columns: string[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasMore: boolean
    }
  }
  error?: string
}

export interface TestDataFilters {
  sourceEmailId?: string
  dateFrom?: string
  dateTo?: string
}

export function useTestDataViewModel() {
  const { state, setLoading, setError, setData } = useViewModelState<TestDataRow>()
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [columns, setColumns] = useState<string[]>([])
  const [currentType, setCurrentType] = useState<TestDataType | null>(null)
  const [filters, setFilters] = useState<TestDataFilters>({})

  const loadData = useCallback(
    async (
      type: TestDataType | 'hours' | 'contracts' | 'finance' | 'bi',
      page: number = 1,
      limit: number = 50,
      dataFilters?: TestDataFilters
    ) => {
      setLoading(true)
      setCurrentType(type as TestDataType)
      try {
        const activeFilters = dataFilters || filters
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        })

        if (activeFilters.sourceEmailId) {
          queryParams.append('sourceEmailId', activeFilters.sourceEmailId)
        }
        if (activeFilters.dateFrom) {
          queryParams.append('dateFrom', activeFilters.dateFrom)
        }
        if (activeFilters.dateTo) {
          queryParams.append('dateTo', activeFilters.dateTo)
        }

        const response = await fetch(`/api/inbox/test-data/${type}?${queryParams.toString()}`)
        const text = await response.text()
        let result: TestDataResponse
        try {
          if (text.startsWith('<')) {
            result = { success: false, error: response.ok ? 'Invalid response' : `Server error ${response.status}` }
          } else {
            result = JSON.parse(text) as TestDataResponse
          }
        } catch {
          result = { success: false, error: 'Invalid JSON from server' }
        }

        if (result.success && result.data) {
          setData(result.data.rows)
          setTotal(result.data.pagination.total)
          setTotalPages(result.data.pagination.totalPages)
          setHasMore(result.data.pagination.hasMore)
          setColumns(result.data.columns)
          setCurrentPage(page)
        } else {
          setError(result.error || 'Failed to load test data')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load test data')
      }
    },
    [setLoading, setError, setData, filters]
  )

  const updateFilters = useCallback(
    (newFilters: TestDataFilters) => {
      setFilters(newFilters)
      if (currentType) {
        loadData(currentType, 1, 50, newFilters)
      }
    },
    [loadData, currentType]
  )

  const goToPage = useCallback(
    (page: number) => {
      if (currentType) {
        loadData(currentType, page, 50, filters)
      }
    },
    [loadData, currentType, filters]
  )

  const refresh = useCallback(() => {
    if (currentType) {
      loadData(currentType, currentPage, 50, filters)
    }
  }, [loadData, currentType, currentPage, filters])

  return {
    state,
    currentPage,
    total,
    totalPages,
    hasMore,
    columns,
    currentType,
    filters,
    loadData,
    updateFilters,
    goToPage,
    refresh,
    setLoading,
    setError,
  }
}
