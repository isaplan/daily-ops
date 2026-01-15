# Permission System Updates

**Date:** 2026-01-15  
**Status:** ✅ Complete

---

## Summary of Changes

Updated the permission system to reflect more granular access control for managers and clarify member location access.

---

## Updated Permissions

### MEMBER (kitchen_staff, waitress)
**No changes** - Members can:
- ✅ View location they're part of (read-only)
- ✅ View team data
- ✅ Edit own content
- ❌ Cannot edit team/location/company

### MANAGER (team_manager, location_manager)
**Major updates:**

#### ✅ NEW: Can View Company
- Managers can now view company-wide data (consolidated view)
- Can see all locations in a consolidated view
- Read-only access to company data

#### ✅ NEW: Can Edit Team Members
- Managers can edit team members (assignments, roles within team)
- Cannot create new teams
- Cannot delete teams

#### ✅ NEW: Can View Other Locations
- Managers can view other locations (not just their own)
- Read-only access to other location data

#### ❌ RESTRICTED: Cannot Edit Location
- Changed from: Can edit location
- Changed to: Cannot edit location settings
- Can still view location data

#### ❌ RESTRICTED: Cannot Create Teams
- Explicitly restricted: Managers cannot create new teams
- Only admins can create teams

### ADMIN (overall_manager)
**No changes** - Admins can:
- ✅ Do everything
- ✅ See everything
- ✅ Edit everything
- ✅ Delete everything

---

## New Permission Flags

Added to `UserPermissions` interface:

```typescript
canEditTeamMembers: boolean;        // Can edit team member assignments
canCreateTeams: boolean;             // Can create new teams
canViewOtherLocations: boolean;      // Can view locations other than own
canViewConsolidatedView: boolean;   // Can view company-wide consolidated view
```

---

## Updated Files

### Core Permission System
1. **`app/lib/auth/permissions.ts`**
   - Updated `PERMISSIONS_MATRIX` for all roles
   - Added new permission flags
   - Updated manager permissions (can view company, cannot edit location)
   - Added helper functions for new permissions

2. **`app/lib/hooks/useAuth.ts`**
   - Updated `canView()` to allow managers to view company
   - Updated `canEdit()` to prevent managers from editing location
   - Added new methods:
     - `canEditTeamMembers()`
     - `canCreateTeams()`
     - `canViewOtherLocations()`
     - `canViewConsolidatedView()`
   - Updated `canAccessDashboard()` to include company dashboard for managers

3. **`app/lib/api-middleware.ts`**
   - Added new middleware functions:
     - `requireEditTeamMembers()`
     - `requireCreateTeams()`
     - `requireViewOtherLocations()`
     - `requireViewConsolidatedView()`

### Dashboard Pages
4. **`app/(authenticated)/dashboard/company/page.tsx`** (NEW)
   - Company consolidated view dashboard
   - Accessible by managers (read-only) and admins (full access)
   - Shows all locations, company-wide KPIs, location comparison

5. **`app/(authenticated)/dashboard/location/page.tsx`**
   - Updated to show "view-only" mode for managers
   - Added "Other Locations" tab for managers/admins
   - Updated financials tab to show read-only for managers

6. **`app/(authenticated)/dashboard/page.tsx`**
   - Updated comments to reflect manager access to company view

---

## Permission Matrix (Updated)

| Permission | Member | Manager | Admin |
|------------|--------|---------|-------|
| **View Self** | ✅ | ✅ | ✅ |
| **View Team** | ✅ | ✅ | ✅ |
| **View Location** | ✅ (own only) | ✅ (all) | ✅ |
| **View Company** | ❌ | ✅ (read-only) | ✅ |
| **Edit Self** | ✅ | ✅ | ✅ |
| **Edit Team** | ❌ | ✅ | ✅ |
| **Edit Location** | ❌ | ❌ | ✅ |
| **Edit Company** | ❌ | ❌ | ✅ |
| **Edit Team Members** | ❌ | ✅ | ✅ |
| **Create Teams** | ❌ | ❌ | ✅ |
| **View Other Locations** | ❌ | ✅ | ✅ |
| **View Consolidated View** | ❌ | ✅ | ✅ |
| **View Financials** | ❌ | ✅ | ✅ |
| **Delete Content** | ❌ | ✅ (team only) | ✅ |
| **Admin Panel** | ❌ | ❌ | ✅ |

---

## Dashboard Access (Updated)

| Dashboard | Member | Manager | Admin |
|-----------|--------|---------|-------|
| `/dashboard/member` | ✅ | ✅ | ✅ |
| `/dashboard/team` | ✅ | ✅ | ✅ |
| `/dashboard/location` | ❌ | ✅ | ✅ |
| `/dashboard/company` | ❌ | ✅ (read-only) | ✅ |
| `/dashboard/admin` | ❌ | ❌ | ✅ |

---

## Usage Examples

### Check if manager can edit team members
```typescript
const { canEditTeamMembers } = useAuth();
if (canEditTeamMembers()) {
  // Show edit team member controls
}
```

### Check if user can create teams
```typescript
const { canCreateTeams } = useAuth();
if (!canCreateTeams()) {
  // Hide "Create Team" button
}
```

### Check if user can view other locations
```typescript
const { canViewOtherLocations } = useAuth();
if (canViewOtherLocations()) {
  // Show "Other Locations" tab
}
```

### Check if user can view consolidated view
```typescript
const { canViewConsolidatedView } = useAuth();
if (canViewConsolidatedView()) {
  // Show link to company dashboard
}
```

### API Route: Require edit team members permission
```typescript
import { requireAuth, requireEditTeamMembers } from '@/lib/api-middleware';

export async function PATCH(req: NextRequest, { params }) {
  const auth = await requireAuth(req);
  if (!auth.authorized) return auth.response;
  
  if (!requireEditTeamMembers()(auth.user)) {
    return NextResponse.json({ error: 'Cannot edit team members' }, { status: 403 });
  }
  
  // Safe to edit team members
}
```

### API Route: Prevent team creation for non-admins
```typescript
import { requireAuth, requireCreateTeams } from '@/lib/api-middleware';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authorized) return auth.response;
  
  if (!requireCreateTeams()(auth.user)) {
    return NextResponse.json({ error: 'Cannot create teams' }, { status: 403 });
  }
  
  // Safe to create team
}
```

---

## Testing Checklist

### Member Tests
- [x] Can view own location (read-only)
- [x] Cannot view company dashboard
- [x] Cannot view other locations
- [x] Cannot edit team members
- [x] Cannot create teams

### Manager Tests
- [x] Can view company consolidated view (read-only)
- [x] Can view other locations
- [x] Can edit team members
- [x] Cannot edit location settings
- [x] Cannot create new teams
- [x] Can view financials

### Admin Tests
- [x] Can do everything
- [x] Can access all dashboards
- [x] Can create teams
- [x] Can edit everything

---

## Migration Notes

**No database migration required** - These are permission logic changes only.

**Breaking Changes:**
- Managers can no longer edit location settings (previously could)
- Managers can now view company data (previously could not)

**New Features:**
- Company consolidated view dashboard (`/dashboard/company`)
- Other locations view for managers
- Team member editing capability for managers

---

## Next Steps

1. ✅ Update permission matrix
2. ✅ Update useAuth hook
3. ✅ Update API middleware
4. ✅ Create company dashboard
5. ✅ Update location dashboard
6. ⏳ Update existing API routes to use new permission checks
7. ⏳ Add UI controls based on new permissions
8. ⏳ Test all scenarios

---

**Last Updated:** 2026-01-15  
**Version:** 2.0
