# Permission Matrix & Access Control

**Version:** 1.0  
**Last Updated:** 2026-01-15

---

## Overview

Access control is role-based with three tiers:

1. **MEMBER** (kitchen_staff, waitress)
2. **MANAGER** (team_manager, location_manager)
3. **ADMIN** (overall_manager)

Each role has specific scope access and action permissions.

---

## Role Definitions

### MEMBER
- **Scope:** `self`, `team`
- **Who:** Kitchen staff, waitstaff, basic team members
- **Access:** Personal data + team data (linked members only)
- **Can View:** Own data, team content, team location info (read-only)
- **Can Edit:** Own data and own content only
- **Can Delete:** Nothing
- **Dashboards:** Member, Team

### MANAGER
- **Scope:** `team`, `location`
- **Who:** Team managers, location managers
- **Access:** All team/location data, all member data within location
- **Can View:** Team/location/self data
- **Can Edit:** Team/location/self data and content
- **Can Delete:** Team/location content (not users)
- **Dashboards:** Member, Team, Location
- **Extra:** View financials, manage users within location

### ADMIN
- **Scope:** `self`, `team`, `location`, `company`
- **Who:** Overall manager/business owner
- **Access:** EVERYTHING (all locations, all users, all data)
- **Can View:** Everything
- **Can Edit:** Everything
- **Can Delete:** Everything
- **Dashboards:** Member, Team, Location, Admin (company-wide)
- **Extra:** Admin panel, all financials, user management

---

## Permission Matrix

| Action | Member | Manager | Admin |
|--------|--------|---------|-------|
| **View Self** | ✅ | ✅ | ✅ |
| **View Team** | ✅ | ✅ | ✅ |
| **View Location** | ✅ (read) | ✅ | ✅ |
| **View Company** | ❌ | ❌ | ✅ |
| **Edit Self** | ✅ | ✅ | ✅ |
| **Edit Team** | ❌ | ✅ | ✅ |
| **Edit Location** | ❌ | ✅ | ✅ |
| **Edit Company** | ❌ | ❌ | ✅ |
| **Delete Content** | ❌ | ✅ | ✅ |
| **Delete Users** | ❌ | ❌ | ✅ |
| **View Financials** | ❌ | ✅ | ✅ |
| **Manage Users** | ❌ | ✅ | ✅ |
| **Admin Panel** | ❌ | ❌ | ✅ |

---

## Content Visibility Rules

### By Role

#### MEMBER sees:
- ✅ Own personal data (profile, stats, activity)
- ✅ Assigned todos and notes
- ✅ Team todos, notes, messages, decisions
- ✅ Team member profiles
- ✅ Team location info (name, address only)
- ✅ Messages they're mentioned in
- ❌ Other team's data
- ❌ Other location's data
- ❌ Financial data
- ❌ Private manager notes

#### MANAGER sees:
- ✅ Own personal data
- ✅ All team data
- ✅ All location data
- ✅ All team member data (within location)
- ✅ All team/location content (notes, todos, decisions)
- ✅ Financial data for location
- ✅ Private notes (team & location level)
- ❌ Other location's data (unless admin)
- ❌ Company-wide analytics
- ❌ User management outside location

#### ADMIN sees:
- ✅ EVERYTHING
- ✅ All members at all locations
- ✅ All content at all levels
- ✅ All financial data
- ✅ All private data
- ✅ Company-wide analytics
- ✅ System settings and user management

---

## Dashboard Access

### Member Dashboard
```
/dashboard/member
├─ Personal stats (hours, tasks, revenue)
├─ Team overview
├─ Recent activity (personal + team)
└─ Team members (read-only)
```
**Access:** Members, Managers, Admins

### Team Dashboard
```
/dashboard/team
├─ Team KPIs (hours, labor, revenue, quality)
├─ Team members list with stats
├─ Team tasks
├─ Team notes
├─ Team analytics (managers only)
└─ Team events
```
**Access:** Team members, Managers, Admins

### Location Dashboard
```
/dashboard/location
├─ Location KPIs (hours, labor, revenue, profit)
├─ All location teams
├─ All location members
├─ Location events
├─ Financials (managers only)
└─ Location analytics
```
**Access:** Managers (within location), Admins

### Admin Dashboard (Company)
```
/dashboard/admin
├─ Company KPIs (all metrics)
├─ All locations with stats
├─ All members directory
├─ Financial summary
├─ User management
├─ Reports & analytics
└─ System settings
```
**Access:** Admins only

---

## Content Ownership Rules

### Who can see what?

| Content Type | Owner | Team | Manager (same location) | Other Manager | Admin |
|--------------|-------|------|------------------------|----------------|-------|
| **Personal Note** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Team Note** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Location Note** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Public Note** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Assigned Todo** | Assignee | ✅ | ✅ | ❌ | ✅ |
| **Team Todo** | Owner | ✅ | ✅ | ❌ | ✅ |
| **Decision** | Decided by | Affected members | ✅ | ❌ | ✅ |
| **Message** | Sender | ✅ | ✅ | ❌ | ✅ |

---

## Implementation

### API Route Protection

```typescript
// Example: API route with permission check
import { requireAuth, requireViewAccess } from '@/lib/api-middleware';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authorized) return auth.response;
  
  const user = auth.user;
  
  // Check if user can view location data
  if (!requireViewAccess('location')(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Safe to proceed - fetch and return data
}
```

### Component Permission Check

```typescript
// Example: Component that checks permissions
'use client';

import { useAuth } from '@/lib/hooks/useAuth';

export function LocationFinancials() {
  const { canViewFinancials, canView } = useAuth();
  
  if (!canView('location') || !canViewFinancials()) {
    return <div>No access to financials</div>;
  }
  
  return <div>Financial data...</div>;
}
```

### Dashboard Route Protection

```typescript
// Main dashboard redirects to correct dashboard based on role
export default function DashboardPage() {
  const { isAdmin, isManager, isMember } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (isAdmin) router.push('/dashboard/admin');
    else if (isManager) router.push('/dashboard/location');
    else if (isMember) router.push('/dashboard/member');
  }, []);
}
```

---

## Migration Guide: Adding New Roles

If you need to add a new role (e.g., `supervisor`):

1. **Update Member model** - Add new role type to `roles.role` enum
2. **Update permissions.ts** - Add new role to `PERMISSIONS_MATRIX`
3. **Update useAuth hook** - Add new check method (e.g., `isSupervisor`)
4. **Update api-middleware.ts** - Update `determineRole` function
5. **Update all API routes** - Add permission checks for new role
6. **Create dashboard page** - New `/dashboard/supervisor` route if needed

---

## Security Notes

- ✅ All API routes must validate permissions
- ✅ Frontend checks are UI hints only, not security
- ✅ Always verify permissions on backend
- ✅ Use `requireAuth` on all protected routes
- ✅ Never trust user input for scope/role
- ✅ Log all permission denials for auditing
- ⚠️ Don't expose detailed permission errors to clients

---

## Testing Permission Scenarios

### Scenario 1: Member accessing team data
```
✅ Can view team notes
✅ Can see team members
✅ Can view assigned todos
❌ Cannot edit team notes
❌ Cannot access location dashboard
```

### Scenario 2: Manager accessing location data
```
✅ Can view all location teams
✅ Can view all location members
✅ Can edit team/location notes
✅ Can view financial data
❌ Cannot access other location's data
❌ Cannot access company dashboard
```

### Scenario 3: Admin accessing company data
```
✅ Can access everything
✅ Can edit all content
✅ Can delete anything
✅ Can view all financials
✅ Can manage users
✅ Can access admin panel
```

---

## Monitoring & Auditing

Track these events:
- Permission denied errors (403)
- Successful access to sensitive data
- Role changes
- User creation/deletion
- Financial data access

Use logs for compliance and security auditing.
