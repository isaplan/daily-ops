/**
 * @registry-id: workspaceTypes
 * @created: 2026-01-16T16:15:00.000Z
 * @last-modified: 2026-01-16T16:15:00.000Z
 * @description: Type definitions for workspace switching
 * @last-fix: [2026-01-16] Initial implementation for Design V2 workspace switching
 */

export type WorkspaceId = 'all' | 'locations' | 'daily-ops' | 'global'

export interface WorkspaceFilter {
  workspace_id: WorkspaceId
  location_id?: string
  team_id?: string
}

export interface WorkspaceConfig {
  id: WorkspaceId
  label: string
  fullName: string
  detail: string
}
