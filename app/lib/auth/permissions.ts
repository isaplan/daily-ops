/**
 * @registry-id: permissions
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T14:00:00.000Z
 * @description: Role-based access control system with permissions matrix
 * @last-fix: [2026-01-15] Updated permissions: managers can view company/other locations, edit team members, cannot edit location or create teams
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
  // Specific action permissions
  canEditTeamMembers: boolean;
  canCreateTeams: boolean;
  canViewOtherLocations: boolean;
  canViewConsolidatedView: boolean; // Company-wide consolidated view
}

/**
 * Permission Matrix
 * 
 * MEMBER (kitchen_staff, waitress):
 * - View: Personal data, team content/notes/todos/messages, their location (read-only)
 * - Edit: Personal data, content they own
 * - Can't: Delete anything, view financial data, access admin, edit team/location
 * 
 * MANAGER (team manager, location manager):
 * - View: Team/location data, all member content within scope, company (read-only), other locations, consolidated view
 * - Edit: Team data, team members (can edit team members)
 * - Can't: Edit location, create new teams, delete users, access admin panel
 * - Can: View other locations, view consolidated company-wide view
 * 
 * ADMIN (overall_manager):
 * - View: EVERYTHING
 * - Edit: EVERYTHING
 * - Delete: ANYTHING
 * - Access: Admin panel, all financials, user management, all locations
 */

export const PERMISSIONS_MATRIX: Record<Role, UserPermissions> = {
  member: {
    role: 'member',
    scopes: ['self', 'team'],
    canView: {
      self: true,
      team: true,
      location: true, // Read-only: can see location they're part of
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
    canEditTeamMembers: false,
    canCreateTeams: false,
    canViewOtherLocations: false,
    canViewConsolidatedView: false,
  },

  manager: {
    role: 'manager',
    scopes: ['team', 'location', 'company'], // Can view company (read-only)
    canView: {
      self: true,
      team: true,
      location: true,
      company: true, // Can view company data (consolidated view)
    },
    canEdit: {
      self: true,
      team: true,
      location: false, // Cannot edit location settings
      company: false,
    },
    canDelete: {
      self: false,
      team: true, // Can delete team content, not team itself
      location: false, // Cannot delete location content
      company: false,
    },
    canAccessAdminPanel: false,
    canViewFinancials: true,
    canManageUsers: true, // Within their location
    canEditTeamMembers: true, // Can edit team members
    canCreateTeams: false, // Cannot create new teams
    canViewOtherLocations: true, // Can view other locations
    canViewConsolidatedView: true, // Can view company-wide consolidated view
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
    canEditTeamMembers: true,
    canCreateTeams: true,
    canViewOtherLocations: true,
    canViewConsolidatedView: true,
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
  switch (action) {
    case 'view':
      return permissions.canView[scope];
    case 'edit':
      return permissions.canEdit[scope];
    case 'delete':
      return permissions.canDelete[scope];
    default:
      return false;
  }
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
  manager: ['/dashboard', '/dashboard/team', '/dashboard/location', '/dashboard/company'], // Managers can view company consolidated view
  admin: ['/dashboard', '/dashboard/team', '/dashboard/location', '/dashboard/company', '/dashboard/admin'],
};

/**
 * Check if user can edit team members
 */
export function canEditTeamMembers(role: Role): boolean {
  return PERMISSIONS_MATRIX[role].canEditTeamMembers;
}

/**
 * Check if user can create new teams
 */
export function canCreateTeams(role: Role): boolean {
  return PERMISSIONS_MATRIX[role].canCreateTeams;
}

/**
 * Check if user can view other locations (not just their own)
 */
export function canViewOtherLocations(role: Role): boolean {
  return PERMISSIONS_MATRIX[role].canViewOtherLocations;
}

/**
 * Check if user can view consolidated company-wide view
 */
export function canViewConsolidatedView(role: Role): boolean {
  return PERMISSIONS_MATRIX[role].canViewConsolidatedView;
}
