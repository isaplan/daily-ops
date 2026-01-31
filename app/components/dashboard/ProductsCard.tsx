/**
 * @registry-id: ProductsCard
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Products card - top sellers / profitable, embedded names
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/daily-ops/page.tsx
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardProducts } from '@/lib/types/dashboard.types';

interface ProductsCardProps {
  products: DashboardProducts | null;
  isLoading: boolean;
}

export function ProductsCard({ products, isLoading }: ProductsCardProps) {
  if (isLoading) {
    return (
      <Card className="border-white/10 bg-slate-900/70">
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!products) return null;

  const topSellers = products.top_sellers ?? [];
  const topProfitable = products.top_profitable ?? [];

  return (
    <Card className="border-white/10 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-lg text-slate-200">Products</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {topSellers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-400">Top sellers</p>
            <ul className="space-y-1 text-sm">
              {topSellers.slice(0, 5).map((p) => (
                <li
                  key={p.product_id.toString()}
                  className="flex justify-between text-slate-300"
                >
                  <span>{p.product_name}</span>
                  <span>{p.quantity} · €{p.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {topProfitable.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-400">Top profitable</p>
            <ul className="space-y-1 text-sm">
              {topProfitable.slice(0, 5).map((p) => (
                <li
                  key={p.product_id.toString()}
                  className="flex justify-between text-slate-300"
                >
                  <span>{p.product_name}</span>
                  <span>€{p.margin.toLocaleString(undefined, { minimumFractionDigits: 2 })} margin</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {topSellers.length === 0 && topProfitable.length === 0 && (
          <p className="text-sm text-slate-500">No product data for this period.</p>
        )}
      </CardContent>
    </Card>
  );
}
