/**
 * @registry-id: collaborationPage
 * @created: 2026-01-16T15:50:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Collaboration dashboard page (Server Component) - Design V2
 * @last-fix: [2026-01-24] Moved to /daily-work/collaboration
 *
 * @imports-from:
 *   - app/components/collaboration/CollaborationDashboard.tsx => Client dashboard component
 */

import { Suspense } from 'react'
import CollaborationDashboard from '@/components/collaboration/CollaborationDashboard'
import { Skeleton } from '@/components/ui/skeleton'

function CollaborationContent() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <CollaborationDashboard />
    </Suspense>
  )
}

export default function CollaborationPage() {
  return <CollaborationContent />
}

