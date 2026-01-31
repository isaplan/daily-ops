/**
 * @registry-id: DailyOpsDashboardClient
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Client dashboard - date/location picker + useDailyOpsDashboard + dashboard components
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/daily-ops/page.tsx
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useDailyOpsDashboard } from '@/lib/hooks/useDailyOpsDashboard';
import { RevenueCard } from '@/components/dashboard/RevenueCard';
import { LaborCard } from '@/components/dashboard/LaborCard';
import { ProductsCard } from '@/components/dashboard/ProductsCard';
import { KPIGrid } from '@/components/dashboard/KPIGrid';
import { HealthStatus } from '@/components/dashboard/HealthStatus';
import { DataQualityAlert } from '@/components/dashboard/DataQualityAlert';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type LocationOption = { _id: string; name: string };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyOpsDashboardClient() {
  const searchParams = useSearchParams();
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);

  const date = searchParams.get('date') ?? todayISO();
  const locationIdParam = searchParams.get('location');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(locationIdParam);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/locations');
        const json = await res.json();
        if (!cancelled && json?.data?.length) {
          setLocations(json.data);
          if (!selectedLocationId && json.data[0]?._id) {
            setSelectedLocationId(String(json.data[0]._id));
          }
        }
      } finally {
        if (!cancelled) setLocationsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (locationIdParam) setSelectedLocationId(locationIdParam);
  }, [locationIdParam]);

  const { data, loading, error, refetch } = useDailyOpsDashboard(
    date,
    selectedLocationId
  );

  const updateLocation = useCallback(
    (value: string) => {
      setSelectedLocationId(value || null);
      const url = new URL(window.location.href);
      if (value) url.searchParams.set('location', value);
      else url.searchParams.delete('location');
      window.history.replaceState({}, '', url.toString());
    },
    []
  );

  const updateDate = useCallback(
    (newDate: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set('date', newDate);
      window.history.replaceState({}, '', url.toString());
    },
    []
  );

  if (locationsLoading && locations.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const hasLocation = Boolean(selectedLocationId);
  const showDashboard = hasLocation && (data || loading);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Daily Ops</h1>
          <p className="text-slate-400 mt-1">Revenue, labor, products — single query, no lookups</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="daily-ops-date">Date</label>
          <input
            id="daily-ops-date"
            type="date"
            value={date}
            onChange={(e) => updateDate(e.target.value)}
            className="rounded-md border border-white/20 bg-slate-800/50 px-3 py-2 text-sm text-white"
            aria-label="Select date"
          />
          <Select
            value={selectedLocationId ?? ''}
            onValueChange={updateLocation}
          >
            <SelectTrigger className="w-[200px] border-white/20 bg-slate-800/50 text-white">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc._id} value={String(loc._id)}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {!hasLocation && (
        <Alert>
          <AlertDescription>Select a location to view the dashboard.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DataQualityAlert sources={data?.sources ?? null} />

      {showDashboard && (
        <>
          <KPIGrid kpis={data?.kpis ?? null} isLoading={loading} />
          <div className="grid gap-6 lg:grid-cols-3">
            <RevenueCard revenue={data?.revenue ?? null} isLoading={loading} />
            <LaborCard labor={data?.labor ?? null} isLoading={loading} />
            <ProductsCard products={data?.products ?? null} isLoading={loading} />
          </div>
          <HealthStatus sources={data?.sources ?? null} isLoading={loading} />
        </>
      )}
    </div>
  );
}
