# Dashboard & Access Control Guide

**Quick Reference for Developers**

---

## 🎯 Three-Tier Access Model

```
┌─────────────────────────────────────────────────────────────┐
│ ADMIN (overall_manager)                                     │
├─────────────────────────────────────────────────────────────┤
│ • Access: EVERYTHING (all locations, users, data)           │
│ • Dashboards: Member → Team → Location → Admin              │
│ • Can: View/Edit/Delete everything                          │
│ • Extras: Admin panel, user management, financials          │
├─────────────────────────────────────────────────────────────┤
│ MANAGER (manager, location_manager)                         │
├─────────────────────────────────────────────────────────────┤
│ • Access: Team + Location data (within scope)               │
│ • Dashboards: Member → Team → Location                      │
│ • Can: View/Edit team & location content                    │
│ • Extras: View financials, manage team/location users       │
├─────────────────────────────────────────────────────────────┤
│ MEMBER (kitchen_staff, waitress)                            │
├─────────────────────────────────────────────────────────────┤
│ • Access: Personal + Team data only                         │
│ • Dashboards: Member → Team                                 │
│ • Can: View self & team, edit own content                   │
│ • Cannot: Delete anything, access financials               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Dashboard Routes

| Route | Access | Who |
|-------|--------|-----|
| `/dashboard` | All | Auto-redirects to role dashboard |
| `/dashboard/member` | All | Members, Managers, Admins |
| `/dashboard/team` | Members+ | Team members, Managers, Admins |
| `/dashboard/location` | Managers+ | Managers & Admins only |
| `/dashboard/admin` | Admins | Admins only |

---

## 🔐 Using Permissions in Code

### Hook: Check Permissions in Components

```typescript
'use client';

import { useAuth } from '@/lib/hooks/useAuth';

export function MyComponent() {
  const { canView, canEdit, canDelete, isManager, isAdmin } = useAuth();
  
  // Check specific scope access
  if (!canView('location')) {
    return <div>No access</div>;
  }
  
  // Check role
  if (isManager) {
    return <div>Manager view</div>;
  }
  
  return <div>Member view</div>;
}
```

### Middleware: Protect API Routes

```typescript
// Example: /api/locations/[id]/route.ts

import { requireAuth, requireViewAccess } from '@/lib/api-middleware';

export async function GET(req: NextRequest, { params }) {
  // Step 1: Check authentication
  const auth = await requireAuth(req);
  if (!auth.authorized) return auth.response;
  
  // Step 2: Check permission
  if (!requireViewAccess('location')(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Step 3: Safe to proceed
  const location = await Location.findById(params.id);
  return NextResponse.json(location);
}
```

---

## 📋 Permission Quick Lookup

### Can MEMBER...?
- View own data? ✅
- View team data? ✅
- View location address? ✅
- Edit own profile? ✅
- Edit team notes? ❌
- See team's location? ✅
- See financials? ❌
- Delete content? ❌
- Manage users? ❌

### Can MANAGER...?
- View team data? ✅
- View location data? ✅
- View company data? ❌
- Edit team content? ✅
- Edit location content? ✅
- View financials? ✅
- Delete team content? ✅
- Manage users (in location)? ✅
- Access admin panel? ❌

### Can ADMIN...?
- View everything? ✅
- Edit everything? ✅
- Delete anything? ✅
- View all financials? ✅
- Manage all users? ✅
- Access admin panel? ✅
- Change roles? ✅

---

## 🛠️ Implementation Checklist

When building a new feature:

- [ ] Check user role with `useAuth()` hook
- [ ] Protect API routes with `requireAuth()` middleware
- [ ] Validate permissions on backend (not frontend)
- [ ] Hide/show UI elements based on `canView()`, `canEdit()`, etc.
- [ ] Return 403 if user lacks permissions
- [ ] Test with each role (member, manager, admin)
- [ ] Document scope in code comments
- [ ] Add to PERMISSION-MATRIX.md if new rules

---

## 📁 Files Reference

| File | Purpose |
|------|---------|
| `app/lib/auth/permissions.ts` | Permission matrix definitions |
| `app/lib/hooks/useAuth.ts` | React hook for permission checks |
| `app/lib/api-middleware.ts` | API route middleware |
| `app/(authenticated)/dashboard/page.tsx` | Dashboard router |
| `app/(authenticated)/dashboard/member/page.tsx` | Member dashboard |
| `app/(authenticated)/dashboard/team/page.tsx` | Team dashboard |
| `app/(authenticated)/dashboard/location/page.tsx` | Location dashboard |
| `app/(authenticated)/dashboard/admin/page.tsx` | Admin dashboard |
| `app/api/auth/me/route.ts` | Current user endpoint |
| `app/api/admin/company-stats/route.ts` | Company stats (admin only) |
| `.cursor/rules/PERMISSION-MATRIX.md` | Detailed permission rules |

---

## 🎓 Examples

### Example 1: Member Viewing Team Dashboard

```
User: John (kitchen_staff)
Action: Navigate to /dashboard/team

1. useAuth() returns: role='member', team_id='abc123'
2. canView('team') = true ✅
3. Fetch /api/teams/abc123
4. API checks: requireViewAccess('team')(user) = true ✅
5. Display team data with filtered permissions
```

### Example 2: Manager Accessing Location Financials

```
User: Sarah (manager)
Action: Navigate to /dashboard/location then click "Financials"

1. useAuth() returns: role='manager', location_id='xyz789'
2. canViewFinancials() = true ✅
3. Fetch /api/locations/xyz789/financials
4. API checks: 
   - requireAuth() ✅
   - requireViewAccess('location') ✅
   - canViewFinancials() ✅
5. Display financial data
```

### Example 3: Member Trying to Edit Team Note

```
User: John (member)
Action: Try to edit team note

1. useAuth() returns: role='member'
2. canEdit('team') = false ❌
3. "Edit" button is hidden on frontend
4. If somehow POSTed to API:
   - requireEditAccess('team')(user) = false ❌
   - Return 403 Forbidden
```

### Example 4: Admin Panel Access

```
User: Boss (overall_manager)
Action: Navigate to /dashboard/admin

1. useAuth() returns: role='admin'
2. canAccessAdminPanel() = true ✅
3. Redirect to /dashboard/admin
4. Fetch /api/admin/company-stats
5. API checks:
   - requireAuth() ✅
   - requireRole('admin') ✅
6. Display all company-wide stats and controls
```

---

## ⚠️ Security Notes

1. **Frontend checks are hints only** - Always validate on backend
2. **All API routes must check permissions** - Use requireAuth + scope checks
3. **Never trust role from client** - Determine from database
4. **Log permission denials** - For security auditing
5. **Test with actual roles** - Use test accounts for each role

---

## 🚀 Next Steps

1. Update existing API routes to use permission middleware
2. Create admin stats endpoints for dashboard
3. Add financial data endpoints (manager/admin only)
4. Implement user management panel
5. Add audit logging for permission events

See PERMISSION-MATRIX.md for detailed rules.
