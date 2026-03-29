/**
 * @registry-id: permissions
 * @created: 2026-01-16T16:20:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Permission checks for user roles
 * @last-fix: [2026-01-24] Added PERMISSIONS_MATRIX for API middleware role/scope checks
 */

export type UserRole = 'owner' | 'management' | 'member' | 'external_partner'

export interface User {
  _id: string
  role: UserRole
  email: string
  name: string
}

export function canViewDailyOps(user: User | null): boolean {
  if (!user) return false
  return user.role === 'owner' || user.role === 'management' || user.role === 'external_partner'
}

export function canEditDailyOps(user: User | null): boolean {
  if (!user) return false
  return user.role === 'owner' || user.role === 'management'
}

// === App/API permission matrix (used by app/lib/api-middleware.ts) ===
export type Role = 'member' | 'manager' | 'admin'
export type Scope = 'self' | 'team' | 'location' | 'company'

export type RolePermissions = {
  scopes: Scope[]
  canView: Record<Scope, boolean>
  canEdit: Record<Scope, boolean>
  canDelete: Record<Scope, boolean>
  canEditTeamMembers: boolean
  canCreateTeams: boolean
  canViewOtherLocations: boolean
  canViewConsolidatedView: boolean
}

export const PERMISSIONS_MATRIX: Record<Role, RolePermissions> = {
  member: {
    scopes: ['self', 'team', 'location'],
    canView: { self: true, team: true, location: true, company: false },
    canEdit: { self: true, team: false, location: false, company: false },
    canDelete: { self: false, team: false, location: false, company: false },
    canEditTeamMembers: false,
    canCreateTeams: false,
    canViewOtherLocations: false,
    canViewConsolidatedView: false,
  },
  manager: {
    scopes: ['self', 'team', 'location', 'company'],
    canView: { self: true, team: true, location: true, company: true },
    canEdit: { self: true, team: true, location: false, company: false },
    canDelete: { self: false, team: true, location: true, company: false },
    canEditTeamMembers: true,
    canCreateTeams: false,
    canViewOtherLocations: true,
    canViewConsolidatedView: true,
  },
  admin: {
    scopes: ['self', 'team', 'location', 'company'],
    canView: { self: true, team: true, location: true, company: true },
    canEdit: { self: true, team: true, location: true, company: true },
    canDelete: { self: true, team: true, location: true, company: true },
    canEditTeamMembers: true,
    canCreateTeams: true,
    canViewOtherLocations: true,
    canViewConsolidatedView: true,
  },
}
