/**
 * @registry-id: HealthStatus
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Data sources health - Eitje, Bork, validation status
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/daily-ops/page.tsx
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardSources } from '@/lib/types/dashboard.types';

interface HealthStatusProps {
  sources: DashboardSources | null;
  isLoading: boolean;
}

export function HealthStatus({ sources, isLoading }: HealthStatusProps) {
  if (isLoading) {
    return (
      <Card className="border-white/10 bg-slate-900/70">
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!sources) return null;

  const statusVariant = (ok: boolean | undefined) =>
    ok === true ? 'default' : ok === false ? 'destructive' : 'secondary';

  return (
    <Card className="border-white/10 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-lg text-slate-200">Data sources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sources.eitje && (
          <div className="flex items-center justify-between rounded-lg bg-slate-800/50 p-3">
            <div>
              <span className="font-medium text-white">Eitje</span>
              <div className="flex gap-2 mt-1">
                {sources.eitje.hours_records != null && (
                  <span className="text-xs text-slate-400">{sources.eitje.hours_records} hours</span>
                )}
                <Badge variant={statusVariant(sources.eitje.csv_verified)} className="text-xs">CSV</Badge>
                <Badge variant={statusVariant(sources.eitje.api_verified)} className="text-xs">API</Badge>
              </div>
              {sources.eitje.last_sync && (
                <p className="text-xs text-slate-500 mt-1">Last sync: {sources.eitje.last_sync}</p>
              )}
            </div>
          </div>
        )}
        {sources.bork && (
          <div className="flex items-center justify-between rounded-lg bg-slate-800/50 p-3">
            <div>
              <span className="font-medium text-white">Bork</span>
              <div className="flex gap-2 mt-1">
                {sources.bork.sales_records != null && (
                  <span className="text-xs text-slate-400">{sources.bork.sales_records} sales</span>
                )}
                {sources.bork.total_revenue != null && (
                  <span className="text-xs text-slate-400">€{sources.bork.total_revenue.toLocaleString()}</span>
                )}
                <Badge variant={statusVariant(sources.bork.csv_verified)} className="text-xs">CSV</Badge>
                <Badge variant={statusVariant(sources.bork.api_verified)} className="text-xs">API</Badge>
              </div>
              {sources.bork.last_sync && (
                <p className="text-xs text-slate-500 mt-1">Last sync: {sources.bork.last_sync}</p>
              )}
            </div>
          </div>
        )}
        {sources.validation && (
          <div className="rounded-lg bg-slate-800/50 p-3">
            <span className="text-sm font-medium text-slate-300">Validation</span>
            <div className="flex gap-2 mt-1 flex-wrap">
              {sources.validation.eitje_vs_csv && (
                <Badge variant={sources.validation.eitje_vs_csv.matches ? 'default' : 'destructive'}>
                  Eitje vs CSV {sources.validation.eitje_vs_csv.matches ? '✓' : '✗'}
                </Badge>
              )}
              {sources.validation.bork_vs_csv && (
                <Badge variant={sources.validation.bork_vs_csv.matches ? 'default' : 'destructive'}>
                  Bork vs CSV {sources.validation.bork_vs_csv.matches ? '✓' : '✗'}
                </Badge>
              )}
            </div>
            {sources.validation.last_validated && (
              <p className="text-xs text-slate-500 mt-1">Last: {sources.validation.last_validated}</p>
            )}
          </div>
        )}
        {!sources.eitje && !sources.bork && (
          <p className="text-sm text-slate-500">No source data for this period.</p>
        )}
      </CardContent>
    </Card>
  );
}
