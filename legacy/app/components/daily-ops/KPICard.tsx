/**
 * @registry-id: KPICard
 * @created: 2026-01-16T16:10:00.000Z
 * @last-modified: 2026-01-16T16:10:00.000Z
 * @description: KPI card component using shadcn microcomponents only
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Daily Ops dashboard
 * 
 * @imports-from:
 *   - app/components/ui/** => Shadcn microcomponents only
 * 
 * @exports-to:
 *   ✓ app/components/daily-ops/DailyOpsDashboard.tsx => Uses KPICard
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

interface KPICardProps {
  title: string
  value: string
  trend: 'up' | 'down' | 'stable'
  change: string
}

export default function KPICard({ title, value, trend, change }: KPICardProps) {
  const trendVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    up: 'default',
    down: 'destructive',
    stable: 'secondary',
  }

  return (
    <Card className="border-white/10 bg-slate-900/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-2xl font-bold text-white">{value}</p>
          <div className="flex items-center gap-2">
            <Badge variant={trendVariants[trend]} className="text-xs">
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trend}
            </Badge>
            <span className="text-xs text-slate-400">{change}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
