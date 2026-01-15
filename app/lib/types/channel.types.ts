/**
 * @registry-id: channelTypes
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Channel type definitions - DTOs, filters, form data
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/lib/services/channelService.ts => Uses Channel types
 *   ✓ app/lib/viewmodels/useChannelViewModel.ts => Uses Channel types
 *   ✓ app/components/ChannelForm.tsx => Uses Channel types
 */

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

export interface ChannelFilters {
  type?: string
  location_id?: string
  team_id?: string
  member_id?: string
}

export interface ChannelFormData {
  name: string
  description: string
  type: string
  location_id: string
  team_id: string
  member_id: string
  members: string[]
}
