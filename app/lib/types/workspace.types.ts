/**
 * @registry-id: workspaceTypes
 * @created: 2026-01-16T16:15:00.000Z
 * @last-modified: 2026-01-16T16:20:00.000Z
 * @description: Type definitions for workspace switching
 * @last-fix: [2026-01-16] Added location-specific workspace IDs (HNH, VKB, BEA, LAT)
 */

export type WorkspaceId = 'all' | 'hnh' | 'vkb' | 'bea' | 'lat' | 'daily-ops'

export interface WorkspaceFilter {
  workspace_id: WorkspaceId
  location_id?: string
  location_name?: string
  team_id?: string
}

export interface WorkspaceConfig {
  id: WorkspaceId
  label: string
  fullName: string
  detail: string
  initials: string
  color: string
  location_id?: string
}
