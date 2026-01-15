/**
 * @registry-id: locationService
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Location API service - CRUD operations for locations
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useLocationViewModel.ts => Uses locationService for API calls
 */

import { ApiService, type ApiResponse } from './base'

export interface Location {
  _id: string
  name: string
  address?: string
  is_active?: boolean
}

export interface LocationFilters {
  is_active?: boolean
}

export interface CreateLocationDto {
  name: string
  address?: string
}

export interface UpdateLocationDto extends Partial<CreateLocationDto> {}

class LocationService extends ApiService {
  constructor() {
    super('/api')
  }

  async getAll(filters?: LocationFilters): Promise<ApiResponse<Location[]>> {
    const params = new URLSearchParams()
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active))

    const query = params.toString()
    return this.get<Location[]>(`/locations${query ? `?${query}` : ''}`)
  }

  async getById(id: string): Promise<ApiResponse<Location>> {
    return this.get<Location>(`/locations/${id}`)
  }

  async create(data: CreateLocationDto): Promise<ApiResponse<Location>> {
    return this.post<Location>('/locations', data)
  }

  async update(id: string, data: UpdateLocationDto): Promise<ApiResponse<Location>> {
    return this.put<Location>(`/locations/${id}`, data)
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/locations/${id}`)
  }
}

export const locationService = new LocationService()
