# ✅ Eitje Staff Architecture Fix - Option B

**Status:** SUPERSEDED by EITJE_ARCHITECTURE_OPTION_B.md

**Correct approach:**
- Eitje API = SSOT for hours (real-time, includes pending)
- Inbox = SSOT for contracts/wages (enriches members)
- `/eitje-staff` endpoint reads from `members` (not inbox-eitje-contracts)

See: EITJE_ARCHITECTURE_OPTION_B.md for full implementation plan.

---

# 🗑️ inbox-eitje-contracts Removal Plan (OBSOLETE)

## 📊 BEFORE vs AFTER

### Current (Broken) Implementation:
```typescript
// ❌ Reads from EMPTY collection
const raw = await db
  .collection('inbox-eitje-contracts')  // EMPTY!
  .find({})
  .sort({ _id: -1 })
  .toArray()

// ❌ Also reads inbox-eitje-hours for contract dates
const hoursAgg = await db
  .collection('inbox-eitje-hours')  // Used only for dates
  .aggregate([...])
  .toArray()

// Result: No staff data, Nonna not found
```

### New (Working) Implementation:
```typescript
// ✅ Reads from LIVE aggregation (updated 9×/day)
const rawAgg = await db
  .collection('eitje_time_registration_aggregation')  // HAS DATA!
  .find({
    period: { $gte: last60Days },  // Include active staff from last 60 days
    user_name: { $exists: true, $ne: null },
  })
  .project({
    period: 1,
    locationId: 1,
    user_name: 1,
    team_name: 1,
    hourly_rate: 1,          // ✅ Contract info from Eitje API
    contract_type: 1,        // ✅ Contract info from Eitje API
    total_hours: 1,
    support_id: 1,
  })
  .sort({ period: -1 })
  .toArray()

// ✅ Deduplicates by user_name + locationId
// ✅ Shows: Nonna + all 62 recent staff
// ✅ Includes: recent_hours, last_worked date
```

---

## 📝 FILES TO CHANGE

### 1. **Core API Endpoint** (CRITICAL)
**File:** `server/api/daily-ops/eitje-staff.get.ts`

**Changes:**
- ❌ Remove: `inbox-eitje-contracts` query (lines 113-117)
- ❌ Remove: `inbox-eitje-hours` aggregation for dates (lines 149-180)
- ✅ Add: Read from `eitje_time_registration_aggregation` (last 60 days)
- ✅ Add: Deduplicate by `user_name + locationId`
- ✅ Add: Aggregate `total_hours`, `last_worked` per staff member
- ✅ Keep: Members matching logic (support_id, name)
- ✅ Keep: Same API response format (backward compatible)

**New fields in response:**
```typescript
{
  recent_hours: 127.5,        // Total hours last 60 days
  last_worked: "2026-06-05",  // Most recent work date
}
```

**Impact:** ✅ Nonna appears, all staff visible

---

### 2. **Inbox Constants**
**File:** `server/utils/inbox/constants.ts`

**Change:**
```typescript
export const INBOX_TARGET_COLLECTIONS = [
  'inbox-eitje-hours',
  // 'inbox-eitje-contracts',  ❌ REMOVE THIS LINE
  'inbox-eitje-finance',
  // ... rest
]
```

**Impact:** Collection no longer expected by system

---

### 3. **Architecture Docs**
**File:** `ARCHITECTURE.md`

**Update sections:**
- Remove `inbox-eitje-contracts` from data flow diagrams
- Update "Eitje Staff Data" section to clarify:
  - ✅ `eitje_time_registration_aggregation` = SSOT for staff + contract data
  - ❌ `inbox-eitje-contracts` = deprecated, not used

---

### 4. **ADR Log**
**File:** `DECISIONS.md`

**Add new ADR:**
```markdown
## ADR-009: Remove inbox-eitje-contracts Collection

**Date:** 2026-06-06  
**Status:** Accepted

### Context
- `inbox-eitje-contracts` was intended to store contract details from Eitje inbox emails
- Collection is empty (never populated by Gmail sync)
- Contract info (hourly_rate, contract_type) is already in `eitje_time_registration_aggregation`
- Staff endpoint reads from empty collection → no staff data shown

### Decision
Remove all references to `inbox-eitje-contracts`:
1. Update `/api/daily-ops/eitje-staff.get.ts` to read from `eitje_time_registration_aggregation`
2. Remove from `INBOX_TARGET_COLLECTIONS` constant
3. Delete inspection/debug scripts that reference it
4. Update documentation

### Benefits
- ✅ Staff endpoint shows ALL active staff (including Nonna)
- ✅ Real-time contract data from Eitje API (9×/day updates)
- ✅ Simpler architecture (one less collection)
- ✅ No dependency on inbox email parsing

### Consequences
- `startdatum`/`einddatum` fields no longer available (not in aggregation)
- Could derive from first/last `period` if needed later
```

---

### 5. **Scripts to Delete** (Optional cleanup)

These scripts reference `inbox-eitje-contracts` but are likely unused:

```bash
# Delete or update:
scripts/inspect-join-keys-eitje-inbox.ts
scripts/check_contracts.mjs
scripts/check_eitje_data.mjs
scripts/backfill-members-cost-per-hour.ts
scripts/debug-carmen-row.ts
scripts/inspect-inbox-eitje-shapes.ts
```

**Action:** Review each, delete if unused, or update to use `eitje_time_registration_aggregation`

---

## 🔍 VERIFICATION STEPS

After deployment:

1. **Test API:**
   ```bash
   curl http://localhost:8080/api/daily-ops/eitje-staff?limit=100
   ```
   Expected: ✅ 62+ staff members (including Nonna)

2. **Check UI:**
   - Navigate to: `/daily-ops/inbox/eitje-staff`
   - Expected: ✅ All recent staff visible
   - Expected: ✅ Nonna Kolomoitseva in list

3. **Verify Data:**
   ```bash
   # Nonna should appear:
   curl 'http://localhost:8080/api/daily-ops/eitje-staff?search=nonna'
   ```

4. **Check Members Matching:**
   - Unmatched staff (support_id missing) should appear first
   - Matched staff should show `match_confidence: "high"`

---

## 🚀 ROLLOUT PLAN

### Phase 1: Code Update (This PR)
1. ✅ Update `eitje-staff.get.ts` (replace with new implementation)
2. ✅ Update `inbox/constants.ts` (remove from target collections)
3. ✅ Add ADR-009 to `DECISIONS.md`
4. ✅ Update `ARCHITECTURE.md`
5. ✅ Test locally with real data

### Phase 2: Deploy to Production
1. Deploy updated API endpoint
2. Verify Nonna appears in UI
3. Verify all 62+ staff visible

### Phase 3: Cleanup (Later)
1. Delete unused scripts
2. Remove MongoDB collection (if desired)
3. Update any remaining docs

---

## ⚠️ RISKS & MITIGATION

### Risk 1: Missing contract dates (`startdatum`/`einddatum`)
- **Impact:** LOW - These fields were already unreliable (collection empty)
- **Mitigation:** Could derive from first/last `period` in aggregation if needed

### Risk 2: UI expects old response format
- **Impact:** NONE - New response is backward compatible
- **Mitigation:** Only adds new fields (`recent_hours`, `last_worked`)

### Risk 3: Staff count changes
- **Impact:** EXPECTED - Will show MORE staff (was 0, now 62+)
- **Mitigation:** This is the desired outcome

---

## ✅ READY TO PROCEED?

**Summary:**
- 🎯 Main fix: `server/api/daily-ops/eitje-staff.get.ts` (see PROPOSED_eitje-staff.get.ts)
- 📝 Documentation: ADR-009, ARCHITECTURE.md updates
- 🧹 Optional: Delete unused scripts later

**Next step:** Review PROPOSED_eitje-staff.get.ts and approve changes.
