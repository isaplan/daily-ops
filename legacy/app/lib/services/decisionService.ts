/**
 * @registry-id: decisionService
 * @created: 2026-01-16T22:30:00.000Z
 * @last-modified: 2026-01-16T22:30:00.000Z
 * @description: Decision API service - CRUD operations for decisions
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useDecisionViewModel.ts => Uses decisionService for API calls
 */

import { ApiService, type ApiResponse } from './base'

export interface Decision {
  _id: string
  title: string
  description?: string
  decision: string
  status: 'proposed' | 'approved' | 'rejected' | 'implemented'
  created_by?: string | { _id: string; name: string; email: string }
  approved_by?: string | { _id: string; name: string; email: string }
  involved_members?: Array<{ _id: string; name: string; email: string }>
  connected_to?: {
    location_id?: string | { _id: string; name: string }
    team_id?: string | { _id: string; name: string }
    member_id?: string | { _id: string; name: string }
  }
  created_at: string
  updated_at: string
}

export interface DecisionFilters {
  status?: string
  location_id?: string
  team_id?: string
  member_id?: string
}

export interface CreateDecisionDto {
  title: string
  description?: string
  decision: string
  status?: Decision['status']
  created_by?: string
  approved_by?: string
  involved_members?: string[]
  location_id?: string
  team_id?: string
  member_id?: string
}

export interface UpdateDecisionDto extends Partial<CreateDecisionDto> {}

class DecisionService extends ApiService {
  constructor() {
    super('/api')
  }

  async getAll(filters?: DecisionFilters, skip?: number, limit?: number): Promise<ApiResponse<Decision[]>> {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.location_id) params.append('location_id', filters.location_id)
    if (filters?.team_id) params.append('team_id', filters.team_id)
    if (filters?.member_id) params.append('member_id', filters.member_id)
    if (skip !== undefined) params.append('skip', skip.toString())
    if (limit !== undefined) params.append('limit', limit.toString())

    const query = params.toString()
    return this.get<Decision[]>(`/decisions${query ? `?${query}` : ''}`)
  }

  async getById(id: string): Promise<ApiResponse<Decision>> {
    return this.get<Decision>(`/decisions/${id}`)
  }

  async create(data: CreateDecisionDto): Promise<ApiResponse<Decision>> {
    return this.post<Decision>('/decisions', data)
  }

  async update(id: string, data: UpdateDecisionDto): Promise<ApiResponse<Decision>> {
    return this.put<Decision>(`/decisions/${id}`, data)
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/decisions/${id}`)
  }
}

export const decisionService = new DecisionService()
