# Implementation Summary: ADR-009 Option B

**Branch:** `feature/eitje-staff-remove-inbox-contracts`  
**Date:** 2026-06-06  
**Status:** ✅ Complete

---

## 🎯 Objective

Implement **Option B** architecture where:
1. **Eitje API** = SSOT for hours (real-time, includes pending shifts)
2. **Inbox morning email** = SSOT for contracts (hourly_rate, contract_type, support_id)
3. **Members collection** = Unified staff profiles (enriched from both)

---

## ✅ Changes Made

### 1. Staff Endpoint Rewrite
**File:** `server/api/daily-ops/eitje-staff.get.ts`

**Before:**
- ❌ Read from `inbox-eitje-contracts` (EMPTY collection)
- ❌ No activity data shown
- ❌ No data source indicators

**After:**
- ✅ Read from `members` collection (SSOT for staff profiles)
- ✅ Enriched with API activity from `eitje_time_registration_aggregation` (last 30 days)
- ✅ Shows data source indicators (`contract: members`, `activity: api`)
- ✅ Flags missing critical data (hourly_rate, contract_type, support_id)
- ✅ Sortable by missing data priority

**New Response Fields:**
```typescript
{
  member_id: string
  employee_name: string
  recent_activity: {
    last_worked: string | null
    total_hours: number
    teams: string[]
  }
  data_sources: {
    contract: 'members' | 'missing'
    activity: 'api' | 'none'
  }
  missing_data: string[]  // ['hourly_rate', 'contract_type', 'support_id']
}
```

---

### 2. Inbox Contract Processing
**File:** `server/services/dataMappingService.ts`

**Changes:**
- ✅ Now processes **both** `inbox-eitje-hours` AND `inbox-eitje-contracts` for member updates
- ✅ Applies contract data (hourly_rate, contract_type, support_id) to members
- ✅ Updated metadata: `@adr-ref: ADR-009`

**Logic:**
```typescript
// Both 'contracts' and 'hours' CSVs contain contract fields
if (documentType === 'contracts' || documentType === 'hours') {
  for (const row of mappedRows) {
    if (row.hourly_rate || row.contract_type || row.support_id) {
      await applyContractInboxRowToMember(database, row)
    }
  }
}
```

---

### 3. Manual Refresh Endpoint
**File:** `server/api/daily-ops/eitje-staff-refresh-from-inbox.post.ts` (NEW)

**Purpose:** Retroactive contract updates from inbox-eitje-hours

**Usage:**
```bash
POST /api/daily-ops/eitje-staff-refresh-from-inbox
Body: { "month": "2026-06" }  # Optional, defaults to current month
```

**Returns:**
```json
{
  "success": true,
  "month": "2026-06",
  "total_rows": 1247,
  "unique_staff": 62,
  "updated": 58,
  "skipped": 4
}
```

---

### 4. Ops Notifications - Staff Data Quality
**File:** `server/utils/opsNotifications/detectors/eitjeStaffData.ts` (NEW)

**Detects:**
1. **Staff in API but NOT in members** (new staff not yet in system)
   - Severity: Warning
   - Action: Add to members with contract details

2. **Staff missing critical data** (hourly_rate, contract_type, support_id)
   - Severity: Error
   - Action: Update members collection
   - Blocks accurate cost calculations

**Integration:**
- ✅ Added to `runOpsNotificationScan.ts`
- ✅ Runs automatically with other ops checks
- ✅ Visible in `/ops-notifications` UI

---

### 5. Documentation
**Files:**
- ✅ `DECISIONS.md` — Added ADR-009
- ✅ `EITJE_ARCHITECTURE_OPTION_B.md` — Complete architecture guide
- ✅ `INBOX_EITJE_CONTRACTS_REMOVAL_PLAN.md` — Marked obsolete (superseded by Option B)

---

## 📊 Expected Outcomes

### Before (Broken):
- ❌ Eitje staff endpoint showed 67 staff from empty `inbox-eitje-contracts`
- ❌ Nonna Kolomoitseva NOT visible (not in inbox-eitje-contracts)
- ❌ No data source transparency
- ❌ No missing data alerts

### After (Fixed):
- ✅ Staff endpoint reads from `members` (unified SSOT)
- ✅ Nonna visible once Eitje API syncs her shifts
- ✅ Recent activity shown (last 30 days from API)
- ✅ Data source indicators (`contract: members`, `activity: api`)
- ✅ Missing data flagged (ops alerts + UI)
- ✅ Manual refresh available for retroactive updates

---

## 🧪 Testing Checklist

### API Endpoint
- [ ] `GET /api/daily-ops/eitje-staff` returns members with activity
- [ ] Response includes `recent_activity` and `data_sources` fields
- [ ] Staff with missing data appear first (sorted by priority)
- [ ] Search filter works (`?search=nonna`)
- [ ] Missing data filter works (`?onlyMissingData=true`)

### Inbox Processing
- [ ] Morning email import updates `inbox-eitje-hours`
- [ ] Contract data from hours rows updates `members` collection
- [ ] Manual refresh endpoint works for current month

### Ops Notifications
- [ ] New staff in API triggers "not in members" alert
- [ ] Missing hourly_rate triggers "missing critical data" alert
- [ ] Alerts visible in `/ops-notifications` UI
- [ ] Alert severity correct (warning vs error)

### Nonna Case
- [ ] After Eitje API sync, Nonna appears in `eitje_time_registration_aggregation`
- [ ] Nonna appears in staff endpoint with recent activity
- [ ] If missing contract data, ops alert fires
- [ ] Morning email updates Nonna's contract data in members

---

## 🚀 Deployment Notes

### Prerequisites
- No database migrations required
- Existing `members` collection used as-is
- Existing inbox collections used as-is

### Post-Deployment
1. Run manual refresh to populate from current month:
   ```bash
   POST /api/daily-ops/eitje-staff-refresh-from-inbox
   Body: { "month": "2026-06" }
   ```

2. Check ops notifications for any missing data alerts

3. Verify staff endpoint shows expected data

---

## 🔄 Rollback Plan

If issues arise:
1. Revert to backup: `server/api/daily-ops/eitje-staff.get.BACKUP.ts`
2. Ops notifications will continue working (non-breaking)
3. Inbox processing will continue working (backward compatible)

---

## 📁 Files Modified

### Core Implementation
- `server/api/daily-ops/eitje-staff.get.ts` (rewritten)
- `server/services/dataMappingService.ts` (enhanced)
- `server/utils/opsNotifications/runOpsNotificationScan.ts` (detector added)

### New Files
- `server/api/daily-ops/eitje-staff-refresh-from-inbox.post.ts`
- `server/utils/opsNotifications/detectors/eitjeStaffData.ts`
- `EITJE_ARCHITECTURE_OPTION_B.md`

### Documentation
- `DECISIONS.md` (ADR-009 added)
- `function-registry.json` (updated)

### Backups
- `server/api/daily-ops/eitje-staff.get.OLD.ts`
- `server/api/daily-ops/eitje-staff.get.ts.BACKUP`

---

## ✅ Success Criteria

1. ✅ Eitje staff endpoint reads from members (not empty inbox-eitje-contracts)
2. ✅ Recent activity from API shown (last 30 days)
3. ✅ Data sources transparent (members vs API)
4. ✅ Missing data flagged and alerted
5. ✅ Manual refresh available for retroactive updates
6. ✅ Ops notifications detect staff data issues
7. ✅ ADR-009 documented
8. ✅ All TODOs completed

**Status:** ✅ **READY FOR COMMIT & TESTING**
