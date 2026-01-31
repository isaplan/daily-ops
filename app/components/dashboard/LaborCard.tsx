/**
 * @registry-id: LaborCard
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Labor card - embedded names, no lookups
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/daily-ops/page.tsx
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardLabor } from '@/lib/types/dashboard.types';

interface LaborCardProps {
  labor: DashboardLabor | null;
  isLoading: boolean;
}

export function LaborCard({ labor, isLoading }: LaborCardProps) {
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

  if (!labor) return null;

  return (
    <Card className="border-white/10 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-lg text-slate-200">Labor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="text-xs text-slate-400">Total hours</p>
            <p className="text-xl font-bold text-white">{labor.total_hours.toLocaleString(undefined, { minimumFractionDigits: 2 })}h</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Total cost</p>
            <p className="text-xl font-bold text-white">€{labor.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          {labor.labor_cost_percentage != null && (
            <div>
              <p className="text-xs text-slate-400">Labor %</p>
              <p className="text-xl font-bold text-white">{labor.labor_cost_percentage.toFixed(1)}%</p>
            </div>
          )}
        </div>
        {labor.byTeam?.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-400">By team</p>
            <ul className="space-y-1 text-sm">
              {labor.byTeam.map((team) => (
                <li
                  key={team.team_id.toString()}
                  className="flex justify-between text-slate-300"
                >
                  <span>{team.team_name}</span>
                  <span>{team.hours.toFixed(1)}h · €{team.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {labor.source && (
          <p className="text-xs text-slate-500">Source: {labor.source}</p>
        )}
      </CardContent>
    </Card>
  );
}
