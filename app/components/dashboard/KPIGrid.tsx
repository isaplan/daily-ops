/**
 * @registry-id: KPIGrid
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: KPI grid - revenue, labor %, margins, no lookups
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/daily-ops/page.tsx
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardKPIs } from '@/lib/types/dashboard.types';

interface KPIGridProps {
  kpis: DashboardKPIs | null;
  isLoading: boolean;
}

export function KPIGrid({ kpis, isLoading }: KPIGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-white/10 bg-slate-900/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">€{kpis.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-slate-400 mt-1">
            {kpis.average_ticket_size != null && `Avg ticket €${kpis.average_ticket_size.toFixed(2)}`}
            {kpis.transactions != null && ` · ${kpis.transactions} txns`}
          </p>
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-slate-900/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Labor cost</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">€{kpis.labor_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-slate-400 mt-1">
            {kpis.labor_cost_percentage.toFixed(1)}% of revenue
          </p>
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-slate-900/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Gross profit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">
            {kpis.gross_profit != null ? `€${kpis.gross_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {kpis.profit_margin != null ? `${kpis.profit_margin.toFixed(1)}% margin` : ''}
          </p>
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-slate-900/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">{kpis.staff_count ?? '—'}</p>
          <p className="text-xs text-slate-400 mt-1">
            {kpis.revenue_per_staff != null && `€${kpis.revenue_per_staff.toFixed(0)}/staff`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
