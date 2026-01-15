/**
 * @registry-id: locationTypes
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Location type definitions - DTOs, filters, form data
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/lib/services/locationService.ts => Uses Location types
 *   ✓ app/lib/viewmodels/useLocationViewModel.ts => Uses Location types
 *   ✓ app/components/LocationList.tsx => Uses Location types
 */

export interface Location {
  _id: string
  name: string
  address?: string
  is_active?: boolean
}

export interface CreateLocationDto {
  name: string
  address?: string
}

export interface UpdateLocationDto extends Partial<CreateLocationDto> {}

export interface LocationFilters {
  is_active?: boolean
}
