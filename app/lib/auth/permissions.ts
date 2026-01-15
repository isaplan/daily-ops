/**
 * @registry-id: permissions
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T12:00:00.000Z
 * @description: Role-based access control system with permissions matrix
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/lib/hooks/useAuth.ts => useAuth hook for permission checks
 * ✓ app/api/middleware.ts => API middleware for protected routes
 * ✓ app/components/** => Permission-based UI rendering
 */

export type Role = 'member' | 'manager' | 'admin';
export type Scope = 'self' | 'team' | 'location' | 'company';

export interface UserPermissions {
  role: Role;
  scopes: Scope[];
  canView: {
    self: boolean;
    team: boolean;
    location: boolean;
    company: boolean;
  };
  canEdit: {
    self: boolean;
    team: boolean;
    location: boolean;
    company: boolean;
  };
  canDelete: {
    self: boolean;
    team: boolean;
    location: boolean;
    company: boolean;
  };
  canAccessAdminPanel: boolean;
  canViewFinancials: boolean;
  canManageUsers: boolean;
}

/**
 * Permission Matrix
 * 
 * MEMBER (kitchen_staff, waitress):
 * - View: Personal data, team content/notes/todos/messages, their location
 * - Edit: Personal data, content they own
 * - Can't: Delete anything, view financial data, access admin
 * 
 * MANAGER (team manager, location manager):
 * - View: Team/location data, all member content within scope
 * - Edit: Team/location data, content within scope
 * - Can't: Delete users, access company-wide data (unless location manager)
 * 
 * ADMIN (overall_manager):
 * - View: EVERYTHING
 * - Edit: EVERYTHING
 * - Delete: ANYTHING
 * - Access: Admin panel, all financials, user management
 */

export const PERMISSIONS_MATRIX: Record<Role, UserPermissions> = {
  member: {
    role: 'member',
    scopes: ['self', 'team'],
    canView: {
      self: true,
      team: true,
      location: true, // Read-only team's location info
      company: false,
    },
    canEdit: {
      self: true,
      team: false,
      location: false,
      company: false,
    },
    canDelete: {
      self: false,
      team: false,
      location: false,
      company: false,
    },
    canAccessAdminPanel: false,
    canViewFinancials: false,
    canManageUsers: false,
  },

  manager: {
    role: 'manager',
    scopes: ['team', 'location'],
    canView: {
      self: true,
      team: true,
      location: true,
      company: false,
    },
    canEdit: {
      self: true,
      team: true,
      location: true,
      company: false,
    },
    canDelete: {
      self: false,
      team: true, // Can delete team content, not team itself
      location: true, // Can delete location content
      company: false,
    },
    canAccessAdminPanel: false,
    canViewFinancials: true,
    canManageUsers: true, // Within their location
  },

  admin: {
    role: 'admin',
    scopes: ['self', 'team', 'location', 'company'],
    canView: {
      self: true,
      team: true,
      location: true,
      company: true,
    },
    canEdit: {
      self: true,
      team: true,
      location: true,
      company: true,
    },
    canDelete: {
      self: true,
      team: true,
      location: true,
      company: true,
    },
    canAccessAdminPanel: true,
    canViewFinancials: true,
    canManageUsers: true,
  },
};

/**
 * Get permissions for a user based on their role
 */
export function getPermissionsForRole(role: Role): UserPermissions {
  return PERMISSIONS_MATRIX[role];
}

/**
 * Check if user can perform action
 */
export function canPerformAction(
  userRole: Role,
  action: 'view' | 'edit' | 'delete',
  scope: Scope
): boolean {
  const permissions = PERMISSIONS_MATRIX[userRole];
  return permissions[`can${action.charAt(0).toUpperCase() + action.slice(1)}`]?.[scope] ?? false;
}

/**
 * Check if user has scope access
 */
export function hasScopeAccess(userRole: Role, scope: Scope): boolean {
  return PERMISSIONS_MATRIX[userRole].scopes.includes(scope);
}

/**
 * Data visibility filter - what content the user can see
 */
export interface ContentVisibilityRules {
  canSeeAllTeamContent: boolean;
  canSeeAllLocationContent: boolean;
  canSeeAllCompanyContent: boolean;
  canSeeFinancials: boolean;
  canSeePrivateNotes: boolean;
}

export function getContentVisibilityRules(userRole: Role): ContentVisibilityRules {
  const permissions = PERMISSIONS_MATRIX[userRole];

  return {
    canSeeAllTeamContent: permissions.canView.team,
    canSeeAllLocationContent: permissions.canView.location,
    canSeeAllCompanyContent: permissions.canView.company,
    canSeeFinancials: permissions.canViewFinancials,
    canSeePrivateNotes: userRole !== 'member', // Only managers/admins see all notes
  };
}

/**
 * Dashboard access routes
 */
export const DASHBOARD_ROUTES: Record<Role, string[]> = {
  member: ['/dashboard', '/dashboard/team'],
  manager: ['/dashboard', '/dashboard/team', '/dashboard/location'],
  admin: ['/dashboard', '/dashboard/team', '/dashboard/location', '/dashboard/admin'],
};
