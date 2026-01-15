/**
 * @registry-id: channelService
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Channel API service - CRUD operations for channels
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/useChannelViewModel.ts => Uses channelService for API calls
 */

import { ApiService, type ApiResponse } from './base'

export interface Channel {
  _id: string
  name: string
  description?: string
  type: string
  members?: Array<{ _id: string; name: string }>
  created_by?: { _id: string; name: string }
  created_at: string
  connected_to?: {
    location_id?: string | { _id: string; name: string }
    team_id?: string | { _id: string; name: string }
    member_id?: string | { _id: string; name: string }
  }
}

export interface ChannelFilters {
  type?: string
  location_id?: string
  team_id?: string
  member_id?: string
}

export interface CreateChannelDto {
  name: string
  description?: string
  type: string
  location_id?: string
  team_id?: string
  member_id?: string
  members?: string[]
  created_by?: string
}

export interface UpdateChannelDto extends Partial<CreateChannelDto> {}

class ChannelService extends ApiService {
  constructor() {
    super('/api')
  }

  async getAll(filters?: ChannelFilters): Promise<ApiResponse<Channel[]>> {
    const params = new URLSearchParams()
    if (filters?.type) params.append('type', filters.type)
    if (filters?.location_id) params.append('location_id', filters.location_id)
    if (filters?.team_id) params.append('team_id', filters.team_id)
    if (filters?.member_id) params.append('member_id', filters.member_id)

    const query = params.toString()
    return this.get<Channel[]>(`/channels${query ? `?${query}` : ''}`)
  }

  async getById(id: string): Promise<ApiResponse<Channel>> {
    return this.get<Channel>(`/channels/${id}`)
  }

  async create(data: CreateChannelDto): Promise<ApiResponse<Channel>> {
    return this.post<Channel>('/channels', data)
  }

  async update(id: string, data: UpdateChannelDto): Promise<ApiResponse<Channel>> {
    return this.put<Channel>(`/channels/${id}`, data)
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/channels/${id}`)
  }
}

export const channelService = new ChannelService()
