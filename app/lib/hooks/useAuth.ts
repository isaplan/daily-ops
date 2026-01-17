/**
 * @registry-id: useAuth
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T14:00:00.000Z
 * @description: Auth hook with role/scope checking and permission evaluation
 * @last-fix: [2026-01-15] Added new permission checks: canEditTeamMembers, canCreateTeams, canViewOtherLocations, canViewConsolidatedView
 * 
 * @exports-to:
 * ✓ app/components/** => useAuth() for permission checks in UI
 * ✓ app/(authenticated)/** => useAuth() for route protection
 */

'use client';

import { useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'member' | 'manager' | 'admin';
  location_id?: string;
  team_id?: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

const DEFAULT_STATE: AuthState = {
  user: null,
  loading: true,
  error: null,
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(DEFAULT_STATE);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  async function fetchCurrentUser() {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        // 401 is expected when not authenticated - don't treat as error
        if (response.status === 401) {
          setState({
            user: null,
            loading: false,
            error: null, // Don't set error for expected unauthenticated state
          });
        } else {
          setState({
            user: null,
            loading: false,
            error: 'Not authenticated',
          });
        }
        return;
      }

      const user = await response.json();
      setState({
        user,
        loading: false,
        error: null,
      });
    } catch (error) {
      // Network errors or other issues - don't spam console
      setState({
        user: null,
        loading: false,
        error: null, // Silently handle errors in development
      });
    }
  }

  /**
   * Check if user can view content at specific scope
   */
  const canView = (scope: 'self' | 'team' | 'location' | 'company'): boolean => {
    if (!state.user) return false;

    switch (state.user.role) {
      case 'member':
        return scope === 'self' || scope === 'team' || scope === 'location';
      case 'manager':
        return true; // Managers can view all scopes including company
      case 'admin':
        return true;
      default:
        return false;
    }
  };

  /**
   * Check if user can edit content at specific scope
   */
  const canEdit = (scope: 'self' | 'team' | 'location' | 'company'): boolean => {
    if (!state.user) return false;

    switch (state.user.role) {
      case 'member':
        return scope === 'self';
      case 'manager':
        return scope === 'self' || scope === 'team'; // Cannot edit location
      case 'admin':
        return true;
      default:
        return false;
    }
  };

  /**
   * Check if user can delete content at specific scope
   */
  const canDelete = (scope: 'self' | 'team' | 'location' | 'company'): boolean => {
    if (!state.user) return false;

    switch (state.user.role) {
      case 'member':
        return false;
      case 'manager':
        return scope === 'team' || scope === 'location';
      case 'admin':
        return true;
      default:
        return false;
    }
  };

  /**
   * Check if user can access specific dashboard
   */
  const canAccessDashboard = (dashboard: 'member' | 'team' | 'location' | 'company' | 'admin'): boolean => {
    if (!state.user) return false;

    switch (state.user.role) {
      case 'member':
        return dashboard === 'member' || dashboard === 'team';
      case 'manager':
        return dashboard === 'member' || dashboard === 'team' || dashboard === 'location' || dashboard === 'company';
      case 'admin':
        return true;
      default:
        return false;
    }
  };

  /**
   * Check if user can see financials
   */
  const canViewFinancials = (): boolean => {
    if (!state.user) return false;
    return state.user.role === 'manager' || state.user.role === 'admin';
  };

  /**
   * Check if user can manage other users
   */
  const canManageUsers = (): boolean => {
    if (!state.user) return false;
    return state.user.role === 'manager' || state.user.role === 'admin';
  };

  /**
   * Check if user can access admin panel
   */
  const canAccessAdminPanel = (): boolean => {
    if (!state.user) return false;
    return state.user.role === 'admin';
  };

  /**
   * Check if user can edit team members
   */
  const canEditTeamMembers = (): boolean => {
    if (!state.user) return false;
    return state.user.role === 'manager' || state.user.role === 'admin';
  };

  /**
   * Check if user can create new teams
   */
  const canCreateTeams = (): boolean => {
    if (!state.user) return false;
    return state.user.role === 'admin';
  };

  /**
   * Check if user can view other locations (not just their own)
   */
  const canViewOtherLocations = (): boolean => {
    if (!state.user) return false;
    return state.user.role === 'manager' || state.user.role === 'admin';
  };

  /**
   * Check if user can view consolidated company-wide view
   */
  const canViewConsolidatedView = (): boolean => {
    if (!state.user) return false;
    return state.user.role === 'manager' || state.user.role === 'admin';
  };

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user,
    isMember: state.user?.role === 'member',
    isManager: state.user?.role === 'manager',
    isAdmin: state.user?.role === 'admin',
    canView,
    canEdit,
    canDelete,
    canAccessDashboard,
    canViewFinancials,
    canManageUsers,
    canAccessAdminPanel,
    canEditTeamMembers,
    canCreateTeams,
    canViewOtherLocations,
    canViewConsolidatedView,
  };
}
