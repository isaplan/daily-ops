/**
 * @registry-id: dailyOpsService
 * @created: 2026-01-16T16:05:00.000Z
 * @last-modified: 2026-01-16T16:05:00.000Z
 * @description: Daily Ops API service - KPI, revenue, data source operations (MVVM Service Layer)
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Daily Ops dashboard
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 *   - app/lib/types/dailyOps.types.ts => KPI, RevenueData, DataSource types
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useDailyOpsViewModel.ts => Uses dailyOpsService
 */

import { ApiService, type ApiResponse } from './base'
import type { KPI, RevenueData, DataSource } from '@/lib/types/dailyOps.types'

interface Pagination {
  skip: number
  limit: number
}

class DailyOpsService extends ApiService {
  constructor() {
    super('/api')
  }

  async getKPIs(): Promise<ApiResponse<KPI>> {
    return this.get<KPI>('/daily-ops/kpis')
  }

  async getRevenueData(pagination?: Pagination): Promise<ApiResponse<RevenueData>> {
    const params = new URLSearchParams()
    if (pagination) {
      params.append('skip', pagination.skip.toString())
      params.append('limit', pagination.limit.toString())
    }
    return this.get<RevenueData>(`/daily-ops/revenue${params.toString() ? `?${params.toString()}` : ''}`)
  }

  async getDataSourceStatus(): Promise<ApiResponse<DataSource[]>> {
    return this.get<DataSource[]>('/daily-ops/data-sources')
  }

  async processEmailAttachments(): Promise<ApiResponse<{ success: boolean; processed: number }>> {
    return this.post<{ success: boolean; processed: number }>('/daily-ops/process-email', {})
  }
}

export const dailyOpsService = new DailyOpsService()
