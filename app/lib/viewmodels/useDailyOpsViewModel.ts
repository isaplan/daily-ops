/**
 * @registry-id: useDailyOpsViewModel
 * @created: 2026-01-16T16:05:00.000Z
 * @last-modified: 2026-01-16T16:05:00.000Z
 * @description: ViewModel for Daily Ops dashboard (MVVM pattern)
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Daily Ops dashboard
 * 
 * @imports-from:
 *   - app/lib/services/dailyOpsService.ts => dailyOpsService for API calls
 *   - app/lib/types/dailyOps.types.ts => KPI, RevenueData, DataSource types
 * 
 * @exports-to:
 *   ✓ app/components/daily-ops/** => Components use useDailyOpsViewModel
 */

'use client'

import { useState, useCallback } from 'react'
import { dailyOpsService } from '@/lib/services/dailyOpsService'
import type { KPI, RevenueData, DataSource } from '@/lib/types/dailyOps.types'

interface Pagination {
  skip: number
  limit: number
}

interface UseDailyOpsViewModelReturn {
  kpis: KPI | null
  revenue: RevenueData | null
  dataSources: DataSource[]
  loading: boolean
  error: string | null
  loadKPIs: () => Promise<void>
  loadRevenue: (pagination?: Pagination) => Promise<void>
  loadDataSources: () => Promise<void>
  processEmailAttachments: () => Promise<boolean>
  refresh: () => Promise<void>
}

export function useDailyOpsViewModel(): UseDailyOpsViewModelReturn {
  const [kpis, setKPIs] = useState<KPI | null>(null)
  const [revenue, setRevenue] = useState<RevenueData | null>(null)
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadKPIs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await dailyOpsService.getKPIs()
      if (response.success && response.data) {
        setKPIs(response.data)
      } else {
        setError(response.error || 'Failed to load KPIs')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRevenue = useCallback(async (pagination?: Pagination) => {
    try {
      setLoading(true)
      setError(null)
      const response = await dailyOpsService.getRevenueData(pagination)
      if (response.success && response.data) {
        setRevenue(response.data)
      } else {
        setError(response.error || 'Failed to load revenue data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDataSources = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await dailyOpsService.getDataSourceStatus()
      if (response.success && response.data) {
        setDataSources(response.data)
      } else {
        setError(response.error || 'Failed to load data sources')
        setDataSources([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setDataSources([])
    } finally {
      setLoading(false)
    }
  }, [])

  const processEmailAttachments = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true)
      setError(null)
      const response = await dailyOpsService.processEmailAttachments()
      if (response.success) {
        await refresh()
        return true
      } else {
        setError(response.error || 'Failed to process email attachments')
        return false
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    await Promise.all([loadKPIs(), loadRevenue(), loadDataSources()])
  }, [loadKPIs, loadRevenue, loadDataSources])

  return {
    kpis,
    revenue,
    dataSources,
    loading,
    error,
    loadKPIs,
    loadRevenue,
    loadDataSources,
    processEmailAttachments,
    refresh,
  }
}
