/**
 * @registry-id: useRevenueBreakdown
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: ViewModel hook for revenue slice - calls getRevenueBreakdown server action
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/components/dashboard/RevenueCard.tsx (optional slice fetch)
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { getRevenueBreakdown } from '@/actions/daily-ops';
import type { DashboardRevenue } from '@/lib/types/dashboard.types';

export interface UseRevenueBreakdownReturn {
  data: DashboardRevenue | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRevenueBreakdown(
  date: string,
  locationId: string | null
): UseRevenueBreakdownReturn {
  const [data, setData] = useState<DashboardRevenue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRevenue = useCallback(async () => {
    if (!date || !locationId) {
      setData(null);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await getRevenueBreakdown(date, locationId);
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
    fetchRevenue();
  }, [fetchRevenue]);

  return { data, loading, error, refetch: fetchRevenue };
}
