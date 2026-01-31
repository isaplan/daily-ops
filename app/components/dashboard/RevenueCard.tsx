/**
 * @registry-id: RevenueCard
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Revenue card - embedded names, no lookups
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/daily-ops/page.tsx
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardRevenue } from '@/lib/types/dashboard.types';

interface RevenueCardProps {
  revenue: DashboardRevenue | null;
  isLoading: boolean;
}

export function RevenueCard({ revenue, isLoading }: RevenueCardProps) {
  if (isLoading) {
    return (
      <Card className="border-white/10 bg-slate-900/70">
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!revenue) return null;

  return (
    <Card className="border-white/10 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-lg text-slate-200">Revenue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-2xl font-bold text-white">
          €{revenue.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
        {revenue.byTeam?.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-400">By team</p>
            <ul className="space-y-1 text-sm">
              {revenue.byTeam.map((team) => (
                <li
                  key={team.team_id.toString()}
                  className="flex justify-between text-slate-300"
                >
                  <span>{team.team_name}</span>
                  <span>€{team.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {revenue.average_transaction_value != null && (
          <p className="text-xs text-slate-400">
            Avg ticket €{revenue.average_transaction_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            {revenue.transaction_count != null && ` · ${revenue.transaction_count} transactions`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
