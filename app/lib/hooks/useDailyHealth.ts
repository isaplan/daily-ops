/**
 * @registry-id: useDailyHealth
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: ViewModel hook for sources/health slice - calls getDailyHealth server action
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/components/dashboard/HealthStatus.tsx (optional slice fetch)
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { getDailyHealth } from '@/actions/daily-ops';
import type { DashboardSources } from '@/lib/types/dashboard.types';

export interface UseDailyHealthReturn {
  data: DashboardSources | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDailyHealth(
  date: string,
  locationId: string | null
): UseDailyHealthReturn {
  const [data, setData] = useState<DashboardSources | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!date || !locationId) {
      setData(null);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await getDailyHealth(date, locationId);
      if (result && 'error' in result) {
        setError(result.error);
        setData(null);
      } else {
        setData(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date, locationId]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return { data, loading, error, refetch: fetchHealth };
}
