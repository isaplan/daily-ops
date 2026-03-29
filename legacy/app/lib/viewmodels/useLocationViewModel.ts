/**
 * @registry-id: useLocationViewModel
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Location ViewModel - state management and business logic for locations
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/locationService.ts => Location API operations
 *   - app/lib/viewmodels/base.ts => Base ViewModel utilities
 * 
 * @exports-to:
 *   ✓ app/components/LocationList.tsx => Uses useLocationViewModel for list state
 */

'use client'

import { useCallback } from 'react'
import { locationService, type Location, type CreateLocationDto } from '@/lib/services/locationService'
import { useViewModelState } from './base'

export function useLocationViewModel() {
  const { state, setLoading, setError, setData } = useViewModelState<Location>()

  const loadLocations = useCallback(async () => {
    setLoading(true)
    try {
      const response = await locationService.getAll()
      if (response.success && response.data) {
        setData(response.data)
      } else {
        setError(response.error || 'Failed to load locations')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load locations')
    }
  }, [setLoading, setError, setData])

  return {
    locations: state.data,
    loading: state.loading,
    error: state.error,
    loadLocations,
  }
}
