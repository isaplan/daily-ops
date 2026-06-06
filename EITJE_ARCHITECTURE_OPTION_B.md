# Eitje Data Architecture - Option B (APPROVED)

## 🎯 Core Principles

1. **Eitje API** = SSOT for **hours worked** (real-time, includes pending/unapproved shifts)
2. **Inbox morning email** = SSOT for **contract data** (hourly_rate, contract_type, support_id) + validation
3. **Members collection** = Unified staff profiles (enriched from both sources)

---

## 📊 Data Sources & Purpose

### 1. Eitje API (9×/day sync)
**Collection:** `eitje_raw_data` → `eitje_time_registration_aggregation`

**Provides:**
- ✅ All shifts (approved + pending + planned)
- ✅ Real-time hours
- ✅ Team assignments
- ✅ User names
- ❌ Limited contract info (inconsistent from API)

**Used for:**
- Today's dashboard (live data)
- Hour tracking
- Staff activity detection

---

### 2. Inbox Morning Email (daily @ 08:05)
**Collection:** `inbox-eitje-hours`

**Provides:**
- ✅ Approved hours only (finalized yesterday)
- ✅ Complete contract data per staff member:
  - `hourly_rate`
  - `contract_type`
  - `contract_location`
  - `contract_start_date` / `contract_end_date`
  - `support_id`

**Limitations:**
- ❌ Only approved/settled shifts (pending excluded)
- ❌ Delayed by 1 day (yesterday final)

**Used for:**
- Enriching `members` collection with contracts/wages
- Validation of API data
- Historical corrections

---

### 3. Members Collection (SSOT for Staff Profiles)
**Collection:** `members`

**Purpose:**
- Unified staff profiles
- Enriched from both API + inbox
- Used by aggregations for cost calculations

**Update flow:**
```
Inbox morning email → applyContractInboxRowToMember() → members
Eitje API → enriches aggregation with members data
```

---

## 🔄 Data Flow - Option B

### Daily Flow:

```
┌────────────────────────────────────────────────────────┐
│ 1. Eitje API Sync (01, 08, 15, 18-23 + Fri/Sat 02:00) │
│    → Fetch all shifts (approved + pending)             │
│    → eitje_raw_data                                     │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│ 2. Eitje Aggregation Rebuild                           │
│    → Enrich with members (contracts/wages)             │
│    → eitje_time_registration_aggregation               │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│ 3. Inbox Sync (morning @ ~08:30)                       │
│    → Gmail fetch → Parse CSV → inbox-eitje-hours       │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│ 4. Members Update                                       │
│    → applyContractInboxRowToMember()                   │
│    → Update members with latest contracts/wages        │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│ 5. Dashboard Read                                       │
│    → Today: eitje_time_registration_aggregation (API)  │
│    → Yesterday+: daily_ops_snapshot (sealed)            │
└────────────────────────────────────────────────────────┘
```

---

## 📍 Endpoint Purposes

### `/api/daily-ops/eitje-staff`
**Purpose:** Show staff profiles hub (for manual review/management)

**Data source:** `members` collection (enriched from both API + inbox)

**Shows:**
- All staff with recent activity
- Contract status (hourly_rate, contract_type)
- Match status with members SSOT
- Missing data alerts

---

### `/api/daily-ops/inbox/eitje-hours`
**Purpose:** Show raw inbox data (for debugging/validation)

**Data source:** `inbox-eitje-hours` (morning email)

**Shows:**
- Approved hours from yesterday
- Contract data per shift row

---

## 🚨 Ops Notifications (Bug Alerts)

### Alert 1: Staff Data Mismatch
**Detector:** `server/utils/opsNotifications/eitjeStaffMismatch.ts`

**Checks:**
- ✅ Staff in API but NOT in inbox (new staff not yet in morning email)
- ✅ Staff in inbox but NOT in API (inactive staff or sync issue)

**Severity:** Warning

---

### Alert 2: Missing Critical Staff Data
**Detector:** `server/utils/opsNotifications/eitjeStaffMissingData.ts`

**Checks:**
- ❌ Staff missing `hourly_rate`
- ❌ Staff missing `contract_type`
- ❌ Staff missing `support_id`

**Action required:** Manual update in members collection

**Severity:** Error (blocks accurate cost calculations)

---

## 📅 Inbox Period Extension

**Current:** Yesterday only (approved hours)

**New:** Current month (1st to today)

**Purpose:**
- Allow retroactive contract updates
- Capture late approvals
- Historical validation

**Implementation:**
```typescript
// In dataMappingService.ts
const startOfMonth = new Date()
startOfMonth.setDate(1)
startOfMonth.setHours(0, 0, 0, 0)

// Fetch inbox-eitje-hours for current month
const filter = { 
  date: { $gte: startOfMonth, $lte: new Date() } 
}
```

---

## ✅ Benefits of Option B

1. **Real-time accuracy:** API includes pending shifts (today)
2. **Contract completeness:** Inbox provides accurate wages/contracts
3. **Validation layer:** Cross-check API vs inbox for discrepancies
4. **Manual control:** Ops alerts flag issues for manual intervention
5. **Flexibility:** Extend inbox period for historical updates

---

## 🔧 Implementation Checklist

### Phase 1: Core Architecture
- [x] Confirm Eitje API as SSOT for hours
- [x] Confirm inbox as SSOT for contracts
- [x] Confirm members as unified profile SSOT

### Phase 2: Endpoint Updates
- [ ] Update `eitje-staff.get.ts` to read from `members` (not inbox-eitje-contracts)
- [ ] Show API-sourced vs inbox-sourced data indicators
- [ ] Add "last updated" timestamps

### Phase 3: Inbox Period Extension
- [ ] Update inbox query to fetch current month (not just yesterday)
- [ ] Update `applyContractInboxRowToMember` to handle month ranges
- [ ] Add deduplication (latest contract data wins)

### Phase 4: Ops Notifications
- [ ] Create `eitjeStaffMismatch.ts` detector
- [ ] Create `eitjeStaffMissingData.ts` detector
- [ ] Add to ops notifications scan
- [ ] Test with Nonna case

### Phase 5: Documentation
- [ ] Update ADR-009 with Option B decision
- [ ] Update ARCHITECTURE.md
- [ ] Update function-registry.json

---

## 🎯 Success Criteria

1. ✅ Nonna appears in `members` after Eitje API sync
2. ✅ Nonna's contract data updated from next morning inbox email
3. ✅ Dashboard uses API data for today (includes pending shifts)
4. ✅ Ops alert fires if Nonna has hours but missing hourly_rate
5. ✅ Inbox extended to current month for historical updates
