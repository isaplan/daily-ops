/**
 * @registry-id: useLaborMetrics
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: ViewModel hook for labor slice - calls getLaborMetrics server action
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/components/dashboard/LaborCard.tsx (optional slice fetch)
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { getLaborMetrics } from '@/actions/daily-ops';
import type { DashboardLabor } from '@/lib/types/dashboard.types';

export interface UseLaborMetricsReturn {
  data: DashboardLabor | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLaborMetrics(
  date: string,
  locationId: string | null
): UseLaborMetricsReturn {
  const [data, setData] = useState<DashboardLabor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLabor = useCallback(async () => {
    if (!date || !locationId) {
      setData(null);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await getLaborMetrics(date, locationId);
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
    fetchLabor();
  }, [fetchLabor]);

  return { data, loading, error, refetch: fetchLabor };
}
