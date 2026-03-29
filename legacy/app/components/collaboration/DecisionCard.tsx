/**
 * @registry-id: DecisionCard
 * @created: 2026-01-16T15:50:00.000Z
 * @last-modified: 2026-01-16T15:50:00.000Z
 * @description: Decision card component using shadcn microcomponents only
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Collaboration dashboard
 * 
 * @imports-from:
 *   - app/components/ui/** => Shadcn microcomponents only
 * 
 * @exports-to:
 *   ✓ app/components/collaboration/CollaborationDashboard.tsx => Uses DecisionCard
 */

'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface DecisionCardProps {
  decision: {
    _id: string
    title: string
    description: string
    status: 'proposed' | 'approved' | 'rejected' | 'implemented'
    created_at: string
    connected_to?: {
      location_id?: string | { _id: string; name: string }
      team_id?: string | { _id: string; name: string }
    }
  }
}

export default function DecisionCard({ decision }: DecisionCardProps) {
  const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    approved: 'default',
    implemented: 'default',
    proposed: 'secondary',
    rejected: 'destructive',
  }

  return (
    <Card className="border-white/10 bg-slate-900/70 hover:bg-slate-900/90 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg line-clamp-2">{decision.title}</CardTitle>
          <Badge variant={statusVariants[decision.status] || 'outline'}>
            {decision.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-slate-300 line-clamp-3">{decision.description}</p>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              {new Date(decision.created_at).toLocaleDateString()}
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/decisions`}>View</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
