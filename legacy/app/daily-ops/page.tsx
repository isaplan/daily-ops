/**
 * @registry-id: dailyOpsPage
 * @created: 2026-01-16T16:10:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Daily Ops dashboard page - aggregated view, date/location picker
 * @last-fix: [2026-01-30] Wired useDailyOpsDashboard + dashboard components
 *
 * @imports-from:
 *   - app/daily-ops/DailyOpsDashboardClient.tsx => Client dashboard (date/location, hooks, components)
 *
 * @exports-to:
 *   ✓ app/layout.tsx => Route accessible via /daily-ops (role-gated in app/daily-ops/layout.tsx)
 */

import { Suspense } from 'react';
import DailyOpsDashboardClient from './DailyOpsDashboardClient';
import { Skeleton } from '@/components/ui/skeleton';

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
      <DailyOpsDashboardClient />
    </Suspense>
  );
}

export default function DailyOpsPage() {
  return <DailyOpsContent />;
}

