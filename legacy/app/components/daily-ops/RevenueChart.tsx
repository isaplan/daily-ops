/**
 * @registry-id: RevenueChart
 * @created: 2026-01-16T16:10:00.000Z
 * @last-modified: 2026-01-16T16:10:00.000Z
 * @description: Revenue chart component using shadcn Card container
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Daily Ops dashboard
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RevenueData } from '@/lib/types/dailyOps.types'

interface RevenueChartProps {
  data: RevenueData
}

export default function RevenueChart({ data }: RevenueChartProps) {
  const maxRevenue = Math.max(...data.data_points.map((dp) => dp.revenue))

  return (
    <Card className="border-white/10 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-lg">Revenue Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">€{data.total_revenue.toLocaleString()}</p>
              <p className="text-sm text-slate-400">Total Revenue</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-white">{data.total_hours}h</p>
              <p className="text-sm text-slate-400">Total Hours</p>
            </div>
          </div>
          <div className="h-64 flex items-end gap-1">
            {data.data_points.map((dp, idx) => (
              <div
                key={idx}
                className="flex-1 bg-gradient-to-t from-cyan-500/80 to-teal-600 rounded-t"
                style={{ height: `${(dp.revenue / maxRevenue) * 100}%` }}
                title={`${dp.date}: €${dp.revenue}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
