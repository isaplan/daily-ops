/**
 * @registry-id: apiMiddleware
 * @created: 2026-01-15T12:00:00.000Z
 * @last-modified: 2026-01-15T12:00:00.000Z
 * @description: API middleware for permission checks and access control
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/api/** => All API routes using requireAuth, requireRole, requireScope
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Member } from '@/models/Member';
import dbConnect from '@/lib/mongodb';
import { PERMISSIONS_MATRIX, type Role, type Scope } from '@/lib/auth/permissions';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    role: Role;
    location_id?: string;
    team_id?: string;
  };
}

/**
 * Middleware: Require authentication
 * Add user to request if authenticated
 */
export async function requireAuth(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    await dbConnect();
    const member = await Member.findOne({ email: session.user.email });

    if (!member) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'User not found' }, { status: 404 }),
      };
    }

    // Determine role from member's roles array
    const role = determineRole(member.roles);

    return {
      authorized: true,
      user: {
        id: member._id.toString(),
        role,
        location_id: member.location_id?.toString(),
        team_id: member.team_id?.toString(),
      },
    };
  } catch (error) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Authentication error' }, { status: 500 }),
    };
  }
}

/**
 * Middleware: Require specific role
 */
export function requireRole(...roles: Role[]) {
  return function (user: any) {
    return roles.includes(user?.role);
  };
}

/**
 * Middleware: Require specific scope
 */
export function requireScope(...scopes: Scope[]) {
  return function (user: any) {
    const permissions = PERMISSIONS_MATRIX[user?.role];
    return scopes.some(scope => permissions.scopes.includes(scope));
  };
}

/**
 * Middleware: Check if user can view content at scope
 */
export function requireViewAccess(scope: Scope) {
  return function (user: any) {
    const permissions = PERMISSIONS_MATRIX[user?.role];
    return permissions.canView[scope];
  };
}

/**
 * Middleware: Check if user can edit content at scope
 */
export function requireEditAccess(scope: Scope) {
  return function (user: any) {
    const permissions = PERMISSIONS_MATRIX[user?.role];
    return permissions.canEdit[scope];
  };
}

/**
 * Middleware: Check if user can delete content at scope
 */
export function requireDeleteAccess(scope: Scope) {
  return function (user: any) {
    const permissions = PERMISSIONS_MATRIX[user?.role];
    return permissions.canDelete[scope];
  };
}

/**
 * Determine role based on member's roles array
 * Priority: admin > manager > member
 */
export function determineRole(roles: any[]): Role {
  if (roles?.some(r => r.role === 'overall_manager')) return 'admin';
  if (roles?.some(r => r.role === 'manager')) return 'manager';
  return 'member';
}

/**
 * Usage example in API route:
 * 
 * export async function GET(req: NextRequest) {
 *   const auth = await requireAuth(req);
 *   if (!auth.authorized) return auth.response;
 *   const user = auth.user;
 *   
 *   // Check permissions
 *   if (!requireViewAccess('location')(user)) {
 *     return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 *   }
 *   
 *   // Safe to proceed
 *   // ... rest of handler
 * }
 */
