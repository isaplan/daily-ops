/**
 * @registry-id: memberService
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Member API service - CRUD operations for members
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useMemberViewModel.ts => Uses memberService for API calls
 */

import { ApiService, type ApiResponse } from './base'

export interface Member {
  _id: string
  name: string
  email: string
  slack_username?: string
  is_active: boolean
  location_id?: string | { _id: string; name: string }
  team_id?: string | { _id: string; name: string }
}

export interface MemberFilters {
  location_id?: string
  team_id?: string
  is_active?: boolean
}

export interface CreateMemberDto {
  name: string
  email: string
  slack_username?: string
  location_id?: string
  team_id?: string
  roles?: Array<{ role: string; scope: string }>
}

export interface UpdateMemberDto extends Partial<CreateMemberDto> {}

class MemberService extends ApiService {
  constructor() {
    super('/api')
  }

  async getAll(filters?: MemberFilters): Promise<ApiResponse<Member[]>> {
    const params = new URLSearchParams()
    if (filters?.location_id) params.append('location_id', filters.location_id)
    if (filters?.team_id) params.append('team_id', filters.team_id)
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active))

    const query = params.toString()
    return this.get<Member[]>(`/members${query ? `?${query}` : ''}`)
  }

  async getById(id: string): Promise<ApiResponse<Member>> {
    return this.get<Member>(`/members/${id}`)
  }

  async create(data: CreateMemberDto): Promise<ApiResponse<Member>> {
    return this.post<Member>('/members', data)
  }

  async update(id: string, data: UpdateMemberDto): Promise<ApiResponse<Member>> {
    return this.put<Member>(`/members/${id}`, data)
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/members/${id}`)
  }
}

export const memberService = new MemberService()
