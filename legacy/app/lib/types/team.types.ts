/**
 * @registry-id: teamTypes
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Team type definitions - DTOs, filters, form data
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/lib/services/teamService.ts => Uses Team types
 *   ✓ app/lib/viewmodels/useTeamViewModel.ts => Uses Team types
 *   ✓ app/components/TeamList.tsx => Uses Team types
 */

export interface Team {
  _id: string
  name: string
  description?: string
  is_active: boolean
  location_id?: string | { _id: string; name: string }
}

export interface CreateTeamDto {
  name: string
  description?: string
  location_id?: string
}

export interface UpdateTeamDto extends Partial<CreateTeamDto> {}

export interface TeamFilters {
  location_id?: string
  is_active?: boolean
}

export interface TeamFormData {
  name: string
  description: string
  location_id: string
}
