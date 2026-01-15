# Implementation Index: Access Control & Dashboards

**Completed:** 2026-01-15  
**Total Files Created:** 12  
**Total Documentation Pages:** 20+

---

## 📂 Quick File Navigation

### Core Permission System
| File | Purpose | Lines |
|------|---------|-------|
| `app/lib/auth/permissions.ts` | Permission matrix + helper functions | 150 |
| `app/lib/hooks/useAuth.ts` | React hook for auth/permissions | 180 |
| `app/lib/api-middleware.ts` | API route middleware | 140 |

### Dashboard Pages
| File | Purpose | Scope |
|------|---------|-------|
| `app/(authenticated)/dashboard/page.tsx` | Router (auto-redirects) | All users |
| `app/(authenticated)/dashboard/member/page.tsx` | Member dashboard | Members+ |
| `app/(authenticated)/dashboard/team/page.tsx` | Team dashboard | Members+ |
| `app/(authenticated)/dashboard/location/page.tsx` | Location dashboard | Managers+ |
| `app/(authenticated)/dashboard/admin/page.tsx` | Admin dashboard | Admins only |

### API Endpoints
| File | Method | Access | Purpose |
|------|--------|--------|---------|
| `app/api/auth/me/route.ts` | GET | Authenticated | Current user + role |
| `app/api/admin/company-stats/route.ts` | GET | Admin only | Company KPIs |

### Documentation
| File | Length | Focus |
|------|--------|-------|
| `.cursor/rules/PERMISSION-MATRIX.md` | 4 pages | Complete permission rules |
| `DASHBOARD_ACCESS_GUIDE.md` | 3 pages | Developer quick reference |
| `.cursor/rules/ARCHITECTURE-SUMMARY.md` | 4 pages | System architecture |
| `DASHBOARD_HIERARCHY.txt` | 5 pages | Visual diagrams |
| `ACCESS_CONTROL_SUMMARY.txt` | 3 pages | Implementation summary |
| `IMPLEMENTATION_INDEX.md` | This file | Navigation guide |

---

## 🎯 What Each File Does

### `app/lib/auth/permissions.ts`
Defines the permission matrix for all three roles.

**What it exports:**
- `PERMISSIONS_MATRIX` - Permission definitions for member/manager/admin
- `getPermissionsForRole()` - Get permissions for a role
- `canPerformAction()` - Check if action is allowed
- `hasScopeAccess()` - Check scope access
- `getContentVisibilityRules()` - Get content filtering rules
- `DASHBOARD_ROUTES` - Which dashboards each role can access

**How to use:**
```typescript
import { canPerformAction } from '@/lib/auth/permissions';

if (canPerformAction('member', 'view', 'team')) {
  // Member can view team data
}
```

### `app/lib/hooks/useAuth.ts`
React hook for checking user permissions in components.

**What it provides:**
- `user` - Current user object
- `loading` - Loading state
- `isAuthenticated` - Boolean
- `isMember / isManager / isAdmin` - Role checks
- `canView(scope)` - Can view at scope?
- `canEdit(scope)` - Can edit at scope?
- `canDelete(scope)` - Can delete at scope?
- `canAccessDashboard(name)` - Can access dashboard?
- `canViewFinancials()` - Can view financial data?
- `canManageUsers()` - Can manage users?
- `canAccessAdminPanel()` - Can access admin?

**How to use:**
```typescript
'use client';
import { useAuth } from '@/lib/hooks/useAuth';

export function MyComponent() {
  const { canView, isAdmin } = useAuth();
  
  if (!canView('location')) return <div>No access</div>;
  return <div>Location data...</div>;
}
```

### `app/lib/api-middleware.ts`
Middleware for protecting API routes.

**What it exports:**
- `requireAuth()` - Check authentication + get user
- `requireRole(...roles)` - Check if user has role
- `requireScope(...scopes)` - Check if user has scope
- `requireViewAccess(scope)` - Check view permission
- `requireEditAccess(scope)` - Check edit permission
- `requireDeleteAccess(scope)` - Check delete permission
- `determineRole()` - Determine role from member.roles

**How to use:**
```typescript
import { requireAuth, requireViewAccess } from '@/lib/api-middleware';

export async function GET(req) {
  const auth = await requireAuth(req);
  if (!auth.authorized) return auth.response;
  
  if (!requireViewAccess('location')(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Safe to proceed
  const data = await Location.findById(id);
  return NextResponse.json(data);
}
```

### Dashboard Pages (`/dashboard/*/page.tsx`)

#### `/dashboard/page.tsx` (Router)
Auto-redirects to appropriate dashboard:
- Admin → `/dashboard/admin`
- Manager → `/dashboard/location`
- Member → `/dashboard/member`

#### `/dashboard/member/page.tsx`
**Access:** Members, Managers, Admins  
**Shows:**
- Personal stats (hours, tasks, revenue)
- Team overview
- Team members list
- Location information (read-only)
- Recent activity

**Can Edit:** Nothing (members see read-only)

#### `/dashboard/team/page.tsx`
**Access:** Members, Managers, Admins  
**Shows:**
- Team KPIs (hours, cost, revenue, quality)
- Team members with stats
- Team tasks
- Team notes
- Analytics (managers only)

**Can Edit:** Team content (managers only)

#### `/dashboard/location/page.tsx`
**Access:** Managers, Admins only  
**Shows:**
- Location KPIs (6 metrics)
- All location teams
- All location members
- Events section
- Financials (admins only)

**Can Edit:** Location content (managers within location, admins everywhere)

#### `/dashboard/admin/page.tsx`
**Access:** Admins only  
**Shows:**
- Company KPIs (4 core metrics)
- Operational metrics (hours, labor, completion)
- All locations tab
- All members directory
- User management
- Reports & analytics
- System settings

**Can Edit:** Everything

### API Endpoints

#### `GET /api/auth/me`
Returns current authenticated user with role.

**Response:**
```json
{
  "id": "user_id",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "member|manager|admin",
  "location_id": "location_id",
  "team_id": "team_id",
  "slack_avatar": "url",
  "is_active": true
}
```

#### `GET /api/admin/company-stats`
Returns company-wide statistics (admin only).

**Response:**
```json
{
  "totalMembers": 50,
  "activeMembers": 45,
  "totalLocations": 3,
  "totalTeams": 8,
  "totalHours": 1250.5,
  "totalRevenue": 125000,
  "totalLabor": 75000,
  "overallProfit": 50000,
  "taskCompletionRate": 92
}
```

---

## 📚 Documentation Guide

### For Quick Reference
**Read:** `DASHBOARD_ACCESS_GUIDE.md`
- Dashboard routes
- Code examples
- Implementation checklist
- Testing scenarios

### For Complete Rules
**Read:** `.cursor/rules/PERMISSION-MATRIX.md`
- Role definitions
- Permission matrix (complete)
- Content visibility rules
- Security notes
- Migration guide

### For System Architecture
**Read:** `.cursor/rules/ARCHITECTURE-SUMMARY.md`
- Architecture overview
- Data flow examples
- Security implementation
- Files reference
- Next steps

### For Visual Understanding
**Read:** `DASHBOARD_HIERARCHY.txt`
- Dashboard hierarchy diagram
- Access matrix
- Scope hierarchy
- Example user journeys

---

## 🚀 Usage Examples

### Example 1: Add Permission Check to New Component

```typescript
'use client';

import { useAuth } from '@/lib/hooks/useAuth';

export function LocationPanel() {
  const { canView, canEdit } = useAuth();
  
  // Check view permission
  if (!canView('location')) {
    return <div>No access to location</div>;
  }
  
  return (
    <div>
      {canEdit('location') && <EditButton />}
      <LocationData />
    </div>
  );
}
```

### Example 2: Add Permission Check to API Route

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireEditAccess } from '@/lib/api-middleware';

export async function PATCH(req: NextRequest, { params }) {
  // Authenticate
  const auth = await requireAuth(req);
  if (!auth.authorized) return auth.response;
  
  // Check edit permission
  if (!requireEditAccess('location')(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Process update
  const body = await req.json();
  const location = await Location.findByIdAndUpdate(params.id, body);
  
  return NextResponse.json(location);
}
```

### Example 3: Test with Different Roles

1. **Test as Member:**
   - Navigate to `/dashboard` → should go to `/dashboard/member`
   - Can access `/dashboard/team`
   - Cannot access `/dashboard/location` (403)
   - Cannot see "Financials" tab

2. **Test as Manager:**
   - Navigate to `/dashboard` → should go to `/dashboard/location`
   - Can access `/dashboard/location`
   - Can see "Financials" tab
   - Cannot access `/dashboard/admin` (403)

3. **Test as Admin:**
   - Navigate to `/dashboard` → should go to `/dashboard/admin`
   - Can access all dashboards
   - Can see all data
   - Can edit everything

---

## ✅ Implementation Checklist

- [x] Permission matrix defined
- [x] useAuth hook created
- [x] API middleware created
- [x] Dashboard pages created
- [x] Auth endpoints created
- [x] Documentation written
- [ ] Update existing API routes with middleware
- [ ] Add financial data endpoints
- [ ] Create user management UI
- [ ] Add audit logging
- [ ] Test all scenarios

---

## 🔍 Reference Quick Links

**Need to...** → **Read this file:**

- Understand permissions → `PERMISSION-MATRIX.md`
- Use in component → `DASHBOARD_ACCESS_GUIDE.md` (code examples)
- Use in API → `api-middleware.ts` (documentation in file)
- Add new role → `PERMISSION-MATRIX.md` (migration guide section)
- Understand flow → `ARCHITECTURE-SUMMARY.md`
- See visual diagram → `DASHBOARD_HIERARCHY.txt`

---

## 📞 Common Questions

**Q: Where do I check permissions in components?**  
A: Use `useAuth()` hook from `app/lib/hooks/useAuth.ts`

**Q: Where do I protect API routes?**  
A: Use `requireAuth()` + `requireViewAccess()` etc from `app/lib/api-middleware.ts`

**Q: How do I determine user role?**  
A: Call `determineRole()` from api-middleware.ts (it checks database, not request)

**Q: Can I trust role from frontend?**  
A: NO. Always validate on backend from database.

**Q: How do I add a new role?**  
A: See "Migration Guide: Adding New Roles" in `PERMISSION-MATRIX.md`

**Q: Which dashboard should a user see?**  
A: Dashboard router at `/dashboard/page.tsx` decides based on role.

---

## 🎓 Learning Path

1. **Start here:** Read `ACCESS_CONTROL_SUMMARY.txt` (quick overview)
2. **Understand:** Read `DASHBOARD_HIERARCHY.txt` (visual guide)
3. **Reference:** Use `DASHBOARD_ACCESS_GUIDE.md` (quick lookup)
4. **Deep dive:** Read `PERMISSION-MATRIX.md` (complete rules)
5. **Architect:** Read `ARCHITECTURE-SUMMARY.md` (system design)

---

**Last Updated:** 2026-01-15  
**Total Implementation Time:** ~2 hours  
**Ready for:** Integration testing and API route updates
