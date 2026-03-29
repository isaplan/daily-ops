/**
 * @registry-id: useProductAnalysis
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: ViewModel hook for products slice - calls getProductAnalysis server action
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/components/dashboard/ProductsCard.tsx (optional slice fetch)
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { getProductAnalysis } from '@/actions/daily-ops';
import type { DashboardProducts } from '@/lib/types/dashboard.types';

export interface UseProductAnalysisReturn {
  data: DashboardProducts | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProductAnalysis(
  date: string,
  locationId: string | null
): UseProductAnalysisReturn {
  const [data, setData] = useState<DashboardProducts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!date || !locationId) {
      setData(null);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await getProductAnalysis(date, locationId);
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
    fetchProducts();
  }, [fetchProducts]);

  return { data, loading, error, refetch: fetchProducts };
}
