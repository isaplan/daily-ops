/**
 * @registry-id: teamService
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Team API service - CRUD operations for teams
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useTeamViewModel.ts => Uses teamService for API calls
 */

import { ApiService, type ApiResponse } from './base'

export interface Team {
  _id: string
  name: string
  description?: string
  is_active: boolean
  location_id?: string | { _id: string; name: string }
}

export interface TeamFilters {
  location_id?: string
  is_active?: boolean
}

export interface CreateTeamDto {
  name: string
  description?: string
  location_id?: string
}

export interface UpdateTeamDto extends Partial<CreateTeamDto> {}

class TeamService extends ApiService {
  constructor() {
    super('/api')
  }

  async getAll(filters?: TeamFilters): Promise<ApiResponse<Team[]>> {
    const params = new URLSearchParams()
    if (filters?.location_id) params.append('location_id', filters.location_id)
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active))

    const query = params.toString()
    return this.get<Team[]>(`/teams${query ? `?${query}` : ''}`)
  }

  async getById(id: string): Promise<ApiResponse<Team>> {
    return this.get<Team>(`/teams/${id}`)
  }

  async create(data: CreateTeamDto): Promise<ApiResponse<Team>> {
    return this.post<Team>('/teams', data)
  }

  async update(id: string, data: UpdateTeamDto): Promise<ApiResponse<Team>> {
    return this.put<Team>(`/teams/${id}`, data)
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/teams/${id}`)
  }
}

export const teamService = new TeamService()
