/**
 * @registry-id: dailyOpsTypes
 * @created: 2026-01-16T16:05:00.000Z
 * @last-modified: 2026-01-16T16:05:00.000Z
 * @description: Type definitions for Daily Ops dashboard
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Daily Ops dashboard
 * 
 * @exports-to:
 *   ✓ app/lib/services/dailyOpsService.ts => Uses Daily Ops types
 *   ✓ app/lib/viewmodels/useDailyOpsViewModel.ts => Uses Daily Ops types
 *   ✓ app/api/daily-ops/** => API routes use Daily Ops types
 */

export interface KPI {
  hours: {
    total: number
    this_week: number
    last_week: number
    trend: 'up' | 'down' | 'stable'
  }
  revenue: {
    total: number
    this_month: number
    last_month: number
    trend: 'up' | 'down' | 'stable'
  }
  subscriptions: {
    active: number
    new_this_month: number
    cancelled_this_month: number
  }
  last_updated: string
}

export interface RevenueDataPoint {
  date: string
  revenue: number
  hours: number
  pnl?: number
}

export interface RevenueData {
  data_points: RevenueDataPoint[]
  total_revenue: number
  total_hours: number
  average_daily_revenue: number
  period_start: string
  period_end: string
}

export type DataSourceStatus = 'connected' | 'disconnected' | 'error' | 'syncing'

export interface DataSource {
  id: string
  name: 'Eitje' | 'Bork' | 'PowerBI' | 'Email'
  status: DataSourceStatus
  last_sync?: string
  last_sync_successful: boolean
  error_message?: string
}

export interface DataIngestLogEntry {
  _id: string
  source: 'email' | 'api'
  filename?: string
  processed_at: string
  status: 'success' | 'error' | 'processing'
  records_created: number
  error_message?: string
}

export interface DailyOpsDashboardData {
  kpis: KPI
  revenue: RevenueData
  data_sources: DataSource[]
  ingest_log: DataIngestLogEntry[]
}
