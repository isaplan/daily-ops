/**
 * @registry-id: dailyOpsPage
 * @created: 2026-01-16T16:10:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Daily Ops dashboard page (Server Component) - Design V2, permission-gated
 * @last-fix: [2026-01-24] Moved to /daily-ops route segment
 *
 * @imports-from:
 *   - app/components/daily-ops/DailyOpsDashboard.tsx => Client dashboard component
 *
 * @exports-to:
 *   ✓ app/layout.tsx => Route accessible via /daily-ops (role-gated in app/daily-ops/layout.tsx)
 */

import { Suspense } from 'react'
import DailyOpsDashboard from '@/components/daily-ops/DailyOpsDashboard'
import { Skeleton } from '@/components/ui/skeleton'

function DailyOpsContent() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <DailyOpsDashboard />
    </Suspense>
  )
}

export default function DailyOpsPage() {
  return <DailyOpsContent />
}

