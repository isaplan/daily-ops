/**
 * @registry-id: useDailyOpsDashboard
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: ViewModel hook for Daily Ops dashboard - single query, no lookups
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/daily-ops/page.tsx
 *   ✓ app/components/daily-ops/DailyOpsDashboard.tsx
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { getDailyDashboard } from '@/actions/daily-ops';
import type { DailyOpsDashboard } from '@/lib/types/dashboard.types';

export interface UseDailyOpsDashboardReturn {
  data: DailyOpsDashboard | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDailyOpsDashboard(
  date: string,
  locationId: string | null
): UseDailyOpsDashboardReturn {
  const [data, setData] = useState<DailyOpsDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!date || !locationId) {
      setData(null);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await getDailyDashboard(date, locationId);
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date, locationId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, refetch: fetchDashboard };
}
