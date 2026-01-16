/**
 * @registry-id: permissions
 * @created: 2026-01-16T16:20:00.000Z
 * @last-modified: 2026-01-16T16:20:00.000Z
 * @description: Permission checks for user roles
 * @last-fix: [2026-01-16] Added canViewDailyOps permission check
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
