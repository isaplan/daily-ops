/**
 * @registry-id: CollaborationDashboard
 * @created: 2026-01-16T15:50:00.000Z
 * @last-modified: 2026-01-16T15:50:00.000Z
 * @description: Collaboration dashboard component using MVVM pattern and shadcn microcomponents
 * @last-fix: [2026-01-16] Initial implementation for Design V2 Collaboration dashboard
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useCollaborationViewModel.ts => Collaboration ViewModel
 *   - app/components/ui/** => Shadcn microcomponents only
 * 
 * @exports-to:
 *   ✓ app/(authenticated)/collaboration/page.tsx => Uses CollaborationDashboard
 */

'use client'

import { useCollaborationViewModel } from '@/lib/viewmodels/useCollaborationViewModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import NoteCard from './NoteCard'
import DecisionCard from './DecisionCard'
import Link from 'next/link'

export default function CollaborationDashboard() {
  const { dashboardData, loading, error, loadDashboard } = useCollaborationViewModel()

  if (loading && !dashboardData) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!dashboardData) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Collaboration</h1>
          <p className="text-slate-400 mt-1">Projects, Decisions, Notes, and Events</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{dashboardData.summary.total_notes} Notes</Badge>
          <Badge variant="outline">{dashboardData.summary.total_todos} Todos</Badge>
          <Badge variant="outline">{dashboardData.summary.total_decisions} Decisions</Badge>
          <Badge variant="outline">{dashboardData.summary.total_events} Events</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dashboardData.notes.map((note) => (
          <NoteCard key={note._id} note={note} />
        ))}
        {dashboardData.decisions.map((decision) => (
          <DecisionCard key={decision._id} decision={decision} />
        ))}
        {dashboardData.events.map((event) => (
          <Card key={event._id} className="border-white/10 bg-slate-900/70">
            <CardHeader>
              <CardTitle className="text-lg">{event.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant={event.status === 'completed' ? 'default' : 'secondary'}>
                  {event.status}
                </Badge>
                <p className="text-sm text-slate-400">
                  {new Date(event.date).toLocaleDateString()}
                </p>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/events/${event._id}`}>View Event</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
