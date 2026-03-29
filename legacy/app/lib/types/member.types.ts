/**
 * @registry-id: memberTypes
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Member type definitions - DTOs, filters, form data
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/lib/services/memberService.ts => Uses Member types
 *   ✓ app/lib/viewmodels/useMemberViewModel.ts => Uses Member types
 *   ✓ app/components/MemberList.tsx => Uses Member types
 */

export interface Member {
  _id: string
  name: string
  email: string
  slack_username?: string
  is_active: boolean
  location_id?: string | { _id: string; name: string }
  team_id?: string | { _id: string; name: string }
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

export interface MemberFilters {
  location_id?: string
  team_id?: string
  is_active?: boolean
}

export interface MemberFormData {
  name: string
  email: string
  slack_username: string
  location_id: string
  team_id: string
}
