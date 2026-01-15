# Architecture Summary: Access Control & Dashboards

**Created:** 2026-01-15  
**Status:** Complete  
**Files Modified:** 10  
**Files Created:** 9  

---

## What Was Built

A comprehensive role-based access control system with multi-tier dashboards:

### ✅ Files Created

1. **`app/lib/auth/permissions.ts`** - Permission matrix definitions
   - PERMISSIONS_MATRIX for all three roles
   - Helper functions for permission checks
   - Dashboard route mappings

2. **`app/lib/hooks/useAuth.ts`** - React hook for auth/permissions
   - Fetches current user
   - Methods: canView(), canEdit(), canDelete()
   - Dashboard access checks
   - Financial & user management checks

3. **`app/lib/api-middleware.ts`** - API route protection
   - requireAuth() - Verify authentication
   - requireRole() - Check specific role
   - requireScope() - Check scope access
   - requireViewAccess/EditAccess/DeleteAccess() - Scope-specific actions

4. **`app/(authenticated)/dashboard/page.tsx`** - Dashboard router
   - Routes users to correct dashboard based on role
   - Auto-redirect: member → /dashboard/member
   - Auto-redirect: manager → /dashboard/location
   - Auto-redirect: admin → /dashboard/admin

5. **`app/(authenticated)/dashboard/member/page.tsx`** - Member dashboard
   - Personal stats (hours, tasks, revenue)
   - Team overview and members list
   - Location information (read-only)
   - Accessible by: members, managers, admins

6. **`app/(authenticated)/dashboard/team/page.tsx`** - Team dashboard
   - Team KPIs (hours, cost, revenue, quality)
   - Team members with individual stats
   - Tasks and notes sections
   - Analytics tab (managers only)
   - Accessible by: team members, managers, admins

7. **`app/(authenticated)/dashboard/location/page.tsx`** - Location dashboard
   - Location KPIs (members, hours, cost, revenue, profit)
   - All location teams
   - All location members
   - Events section
   - Financials tab (admin only)
   - Accessible by: managers, admins only

8. **`app/(authenticated)/dashboard/admin/page.tsx`** - Admin dashboard
   - Company-wide KPIs
   - All locations with stats
   - User management section
   - Reports & analytics section
   - System settings section
   - Accessible by: admins only

9. **`app/api/auth/me/route.ts`** - Current user endpoint
   - Returns user + role + location/team IDs
   - Used by useAuth hook
   - Returns 401 if not authenticated

10. **`app/api/admin/company-stats/route.ts`** - Company stats endpoint
    - Company-wide aggregated statistics
    - Requires admin role
    - Returns KPIs for admin dashboard

### ✅ Documentation Created

1. **`.cursor/rules/PERMISSION-MATRIX.md`** - Detailed permission rules
   - Role definitions and scopes
   - Complete permission matrix
   - Content visibility rules
   - Dashboard access mapping
   - Implementation examples
   - Security notes

2. **`DASHBOARD_ACCESS_GUIDE.md`** - Quick developer reference
   - Three-tier access overview
   - Dashboard routes table
   - Code usage examples
   - Permission lookup table
   - Implementation checklist
   - Example scenarios

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend Layer                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Dashboard Router (/dashboard)                          │
│  ├─ Member Dashboard (/member)                          │
│  ├─ Team Dashboard (/team)                              │
│  ├─ Location Dashboard (/location)                      │
│  └─ Admin Dashboard (/admin)                            │
│                                                          │
│  Components use: useAuth() hook                         │
│  ├─ Check permissions (canView, canEdit, canDelete)    │
│  ├─ Check role (isAdmin, isManager, isMember)          │
│  └─ Conditional rendering based on access              │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                    API Layer                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Protected Routes (use middleware):                     │
│  ├─ /api/auth/me (any authenticated user)             │
│  ├─ /api/admin/* (admin only)                          │
│  ├─ /api/locations/* (manager+ )                       │
│  ├─ /api/teams/* (team members+)                       │
│  └─ /api/members/* (self + manager/admin)              │
│                                                          │
│  Middleware Stack:                                       │
│  ├─ requireAuth() - Verify session + fetch user        │
│  ├─ requireRole() - Check user role                    │
│  ├─ requireScope() - Check scope access                │
│  └─ requireViewAccess() - Verify view permission       │
│                                                          │
├──────────────────────────────────────────────────────────┤
│              Permission System (Core)                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  PERMISSIONS_MATRIX:                                    │
│  ├─ member: self, team                                 │
│  ├─ manager: team, location                            │
│  └─ admin: self, team, location, company               │
│                                                          │
│  For each role:                                          │
│  ├─ canView: {self, team, location, company}          │
│  ├─ canEdit: {self, team, location, company}          │
│  ├─ canDelete: {self, team, location, company}        │
│  ├─ canAccessAdminPanel: boolean                       │
│  ├─ canViewFinancials: boolean                         │
│  └─ canManageUsers: boolean                            │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                  Database Layer                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Member Model (auth source):                           │
│  ├─ roles: [{ role, scope, grantedAt }]               │
│  ├─ location_id: ObjectId                              │
│  └─ team_id: ObjectId                                  │
│                                                          │
│  Role determination: admin > manager > member           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Data Flow Examples

### Scenario 1: Member Views Team Dashboard

```
1. Member navigates to /dashboard
2. useAuth() determines role='member'
3. Dashboard router redirects to /dashboard/member
4. useAuth() in component: canView('team') = true ✅
5. Component fetches /api/teams/{team_id}
6. API middleware:
   - requireAuth() ✅ (authenticated)
   - requireViewAccess('team') ✅ (member can view team)
7. API returns team data
8. Component renders: team KPIs, members, tasks
```

### Scenario 2: Manager Accesses Location Financials

```
1. Manager navigates to /dashboard
2. useAuth() determines role='manager'
3. Dashboard router redirects to /dashboard/location
4. useAuth() in component: 
   - canView('location') = true ✅
   - canViewFinancials() = true ✅
5. Component shows financials tab
6. Fetch /api/locations/{location_id}/financials
7. API middleware:
   - requireAuth() ✅
   - requireEditAccess('location') ✅ (manager can edit location)
   - canViewFinancials() ✅
8. API returns financial data
9. Component renders: revenue, costs, profit, etc.
```

### Scenario 3: Admin Accesses Company Stats

```
1. Admin navigates to /dashboard
2. useAuth() determines role='admin'
3. Dashboard router redirects to /dashboard/admin
4. Component loads company statistics
5. Fetch /api/admin/company-stats
6. API middleware:
   - requireAuth() ✅
   - requireRole('admin') ✅ (only admins allowed)
7. API aggregates all location stats
8. API returns company-wide KPIs
9. Component renders: all metrics, location list, etc.
```

---

## Security Implementation

### Frontend (UI Protection)
```typescript
// Hide buttons/sections based on permissions
{canEdit('location') && <EditButton />}
{canViewFinancials() && <FinancialsTab />}
{canAccessAdminPanel() && <AdminLink />}
```

### Backend (API Protection)
```typescript
// All API routes validate permissions
const auth = await requireAuth(req);
if (!auth.authorized) return 401;

if (!requireViewAccess('location')(auth.user)) {
  return 403; // Forbidden
}

// Safe to proceed
const data = await Location.findById(id);
return NextResponse.json(data);
```

### Database Layer
```typescript
// Determine role from database roles array
// Never trust role from request
const member = await Member.findOne({ email });
const role = determineRole(member.roles);
// admin > manager > member
```

---

## Usage Quick Start

### Add Permission Check to New API Route

```typescript
import { requireAuth, requireViewAccess } from '@/lib/api-middleware';

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const auth = await requireAuth(req);
  if (!auth.authorized) return auth.response;
  
  // 2. Check permission
  if (!requireViewAccess('location')(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // 3. Proceed with business logic
  const data = await Location.find({});
  return NextResponse.json(data);
}
```

### Add Permission Check to New Component

```typescript
'use client';

import { useAuth } from '@/lib/hooks/useAuth';

export function MyComponent() {
  const { user, loading, canView, canEdit, isManager } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not authenticated</div>;
  
  if (!canView('location')) {
    return <div>No access to location data</div>;
  }
  
  return (
    <div>
      {isManager && <EditButton />}
      <div>Location data...</div>
    </div>
  );
}
```

---

## Testing

Test with these user roles:

1. **Member (kitchen_staff)**
   - ✅ Can access /dashboard/member and /dashboard/team
   - ✅ Can view own profile and team data
   - ❌ Cannot access /dashboard/location or /dashboard/admin
   - ❌ Cannot see financial data

2. **Manager (manager/location_manager)**
   - ✅ Can access member, team, and location dashboards
   - ✅ Can view and edit team/location content
   - ✅ Can see financial data
   - ❌ Cannot access /dashboard/admin
   - ❌ Cannot see other location's data

3. **Admin (overall_manager)**
   - ✅ Can access all dashboards
   - ✅ Can view and edit all data
   - ✅ Can see all financials
   - ✅ Can access admin panel
   - ✅ Can manage all users

---

## Files to Update

When implementing new features:

1. Update API routes to use `requireAuth()` + permission checks
2. Update components to use `useAuth()` hooks
3. Add new permissions to `PERMISSION-MATRIX.md` if needed
4. Test with all three roles

---

## Next Steps

1. ✅ Permission system implemented
2. ✅ Dashboards created
3. ⏳ Update existing API routes with middleware
4. ⏳ Add financial data endpoints
5. ⏳ Create user management UI
6. ⏳ Add audit logging

---

## References

- **Permission Rules:** `.cursor/rules/PERMISSION-MATRIX.md`
- **Developer Guide:** `DASHBOARD_ACCESS_GUIDE.md`
- **Implementation:** `app/lib/auth/` and `app/(authenticated)/dashboard/`
