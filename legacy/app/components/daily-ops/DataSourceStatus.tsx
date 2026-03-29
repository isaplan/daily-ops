/**
 * @registry-id: DataSourceStatus
 * @created: 2026-01-16T16:10:00.000Z
 * @last-modified: 2026-01-16T16:10:00.000Z
 * @description: Data source status component using shadcn microcomponents only
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Daily Ops dashboard
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DataSource } from '@/lib/types/dailyOps.types'

interface DataSourceStatusProps {
  dataSources: DataSource[]
  loading: boolean
}

export default function DataSourceStatus({ dataSources, loading }: DataSourceStatusProps) {
  const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    connected: 'default',
    syncing: 'secondary',
    disconnected: 'outline',
    error: 'destructive',
  }

  return (
    <Card className="border-white/10 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-lg">Data Sources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {dataSources.map((source) => (
          <div key={source.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-white">{source.name}</span>
                <Badge variant={statusVariants[source.status]} className="text-xs">
                  {source.status}
                </Badge>
              </div>
              {source.last_sync && (
                <p className="text-xs text-slate-400">
                  Last sync: {new Date(source.last_sync).toLocaleString()}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm">
              Sync
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
