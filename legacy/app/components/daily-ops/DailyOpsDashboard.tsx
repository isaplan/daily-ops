/**
 * @registry-id: DailyOpsDashboard
 * @created: 2026-01-16T16:10:00.000Z
 * @last-modified: 2026-01-16T16:10:00.000Z
 * @description: Daily Ops dashboard component using MVVM pattern and shadcn microcomponents
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Daily Ops dashboard
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useDailyOpsViewModel.ts => Daily Ops ViewModel
 *   - app/components/ui/** => Shadcn microcomponents only
 * 
 * @exports-to:
 *   ✓ app/(authenticated)/daily-ops/page.tsx => Uses DailyOpsDashboard
 */

'use client'

import { useEffect } from 'react'
import { useDailyOpsViewModel } from '@/lib/viewmodels/useDailyOpsViewModel'
import KPICard from './KPICard'
import DataSourceStatus from './DataSourceStatus'
import RevenueChart from './RevenueChart'
import DataIngestLog from './DataIngestLog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

export default function DailyOpsDashboard() {
  const { kpis, revenue, dataSources, loading, error, loadKPIs, loadRevenue, loadDataSources } =
    useDailyOpsViewModel()

  useEffect(() => {
    loadKPIs()
    loadRevenue({ skip: 0, limit: 30 })
    loadDataSources()
  }, [loadKPIs, loadRevenue, loadDataSources])

  if (loading && !kpis && !revenue) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error && !kpis && !revenue) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Daily Ops</h1>
          <p className="text-slate-400 mt-1">Hours, Revenue, PnL, and Data Sources</p>
        </div>
      </div>

      {kpis && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Hours"
            value={kpis.hours.total.toLocaleString()}
            trend={kpis.hours.trend}
            change={`${kpis.hours.this_week - kpis.hours.last_week > 0 ? '+' : ''}${kpis.hours.this_week - kpis.hours.last_week} this week`}
          />
          <KPICard
            title="Total Revenue"
            value={`€${kpis.revenue.total.toLocaleString()}`}
            trend={kpis.revenue.trend}
            change={`€${(kpis.revenue.this_month - kpis.revenue.last_month).toLocaleString()} vs last month`}
          />
          <KPICard
            title="Active Subscriptions"
            value={kpis.subscriptions.active.toString()}
            trend="stable"
            change={`+${kpis.subscriptions.new_this_month} new, -${kpis.subscriptions.cancelled_this_month} cancelled`}
          />
          <KPICard
            title="Last Updated"
            value={new Date(kpis.last_updated).toLocaleTimeString()}
            trend="stable"
            change={new Date(kpis.last_updated).toLocaleDateString()}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {revenue && (
          <div className="lg:col-span-2">
            <RevenueChart data={revenue} />
          </div>
        )}
        <DataSourceStatus dataSources={dataSources} loading={loading} />
      </div>

      <DataIngestLog />
    </div>
  )
}
