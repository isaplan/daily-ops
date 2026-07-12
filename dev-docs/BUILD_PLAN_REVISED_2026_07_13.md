# Build Plan: Kinsbergen Data + Hourly Basis Fix (Revised 2026-07-13)

## Critical Issues Found (Live Data Verified)

### **ISSUE #1: Direct Code Bug — Reading Wrong Collection**
**File:** `server/utils/dailyOpsSnapshot/resolveSources.ts` (lines 42, 46)

**Problem:** Hardcoded `'bork_business_days'` (without `_v2` suffix) reading from **empty table** (240 old docs, dates 2026-02-16 to 2026-05-11 only).
```
bork_business_days:     240 docs (STALE, Feb–May 2026 only)
bork_business_days_v2: 1655 docs (LIVE, Nov 2024–Jul 2026)
```

**Live impact:** 
- `resolveSources()` always returns `borkCount=0` for any date ≥ May 12, 2026.
- Snapshot metadata reports "0 Bork rows synced" even when `_v2` has live data.
- This is used for provenance tracking, so ops-notifications may show false "no Bork data" alerts.

**Code path:**
```typescript
// LINE 42–46 (WRONG)
db.collection('bork_business_days').countDocuments({ business_date: businessDate, locationId: locOid })
db.collection('bork_business_days').findOne({ business_date: businessDate, locationId: locOid }, ...)
```

**Should use:** `resolveBorkAggReadSuffix()` to query the suffixed table (same pattern used in `dailyOpsSnapshot/buildRevenueSection.ts`, `eitjeSyncService.ts`, etc.).

---

### **ISSUE #2: Location Discovery Fallback Bug — `listLocationIdsForDate`**
**File:** `server/services/dailyOpsSnapshotService.ts` (lines 177–186)

**Problem:** Queries `bork_business_days` (empty table) first, **falls back to Eitje labor rows only**.
```typescript
async function listLocationIdsForDate(db: Db, businessDate: string): Promise<string[]> {
  const [bork, eitje] = await Promise.all([
    db.collection('bork_business_days').distinct('locationId', { business_date: businessDate }),
    db.collection('eitje_time_registration_aggregation').distinct('locationId', { period: businessDate }),
  ])
  // ...
}
```

**Live impact today (2026-07-12):**
- Query on `bork_business_days` → **0 results** (wrong table)
- Fallback to Eitje → only venues with labor shifts get snapshots
- Kinsbergen: 6 Eitje rows (now exists, but earlier today had 0) → **silently skipped when cron ran before shifts clocked in**
- Snapshot never built for VKB, even though Bork had €1,894 of order-time revenue

**Fix needed:** Replace with **hardcoded `VENUE_STRIP_LOCATIONS`** (import from `server/utils/venueStrip/constants.ts`) — these 3 venues are the only ones Daily Ops cares about, always.

---

### **ISSUE #3: Metadata Headers Stale/Wrong**

**Example — `server/utils/dailyOpsSnapshot/resolveSources.ts` (lines 1–18):**
```typescript
/**
 * @architecture:
 *   - One read per source collection (bork_business_days, eitje_time_registration_aggregation, ...)
 *   - Reads only — no writes. Aggregated collections only (no raw scans).
 */
```

**Reality:**
- Code reads `bork_business_days` (stale, Feb–May 2026) ← **WRONG**
- Should document `resolveBorkAggReadSuffix()` + suffix logic
- `@last-modified: 2026-05-25` → **7+ weeks out of date**
- `@last-fix:` dated 2026-05-25 but mentions "PERMANENT FIX" for cron sorting, not for the v2 migration

**Pattern across 33 files in `server/utils/dailyOpsSnapshot/`:**
- Many list `bork_business_days`, `eitje_time_registration_aggregation`, `inbox-bork-basis-report` as SSOT
- But actual code uses `_v2` suffix, `resolveBorkAggReadSuffix()`, and cascaded read-cache logic
- Metadata → **not synced after v2 migration or read-cache architecture changes**

**Why metadata matters (from agent-rules.mdc):**
> "If metadata says 'exports-to X, Y, Z' and you don't update them → **AUTOMATIC FAILURE**"
> 
> Metadata **is** the synchronization mechanism. When it's wrong, devs pick the wrong table, add wrong dependencies, and create new bugs.

---

### **ISSUE #4: Obsolete Scripts Still Referencing Old Table**

Files that read `bork_business_days` (without suffix):
1. `scripts/inspect-bork-vat-shape.ts` — debug script, obsolete?
2. `scripts/inspect-id-types.ts` — debug script, obsolete?
3. `scripts/inspect-vat-coverage.ts` — debug script, obsolete?
4. `scripts/backfill-bork-vat-fields.ts` — backfill script, one-time use?

These scripts **confuse developers** who might copy their patterns into production code.

---

## Revised Build Plan

### **Phase 1 — Fix Direct Code Bugs (Unblocks All Other Phases)**

#### **1a. `server/utils/dailyOpsSnapshot/resolveSources.ts` — Use Suffixed Collection**
- **Lines 42, 46:** Replace `'bork_business_days'` with query that uses `resolveBorkAggReadSuffix()`
- **Line 92 & return fingerprint:** Update `collection` field to document actual suffixed name (e.g., `bork_business_days_v2` or dynamic)
- **Metadata header (lines 1–18):** 
  - Update `@last-modified` to 2026-07-13
  - Update `@architecture` to document suffix logic + `resolveBorkAggReadSuffix()`
  - Update `@last-fix: [2026-07-13] Use resolveBorkAggReadSuffix() to read from live _v2 table, not stale bork_business_days`

**Import needed:**
```typescript
import { resolveBorkAggReadSuffix } from '../bork/resolveBorkAggReadSuffix'
```

---

#### **1b. `server/services/dailyOpsSnapshotService.ts` — Hardcode Venue List**
- **Lines 177–186:** Replace `listLocationIdsForDate()` function entirely
- **New implementation:**
```typescript
import { VENUE_STRIP_LOCATIONS } from '../utils/venueStrip/constants'

async function listLocationIdsForDate(db: Db, businessDate: string): Promise<string[]> {
  // SSOT: Always build snapshots for exactly these 3 venues.
  // (Previously fell back to Eitje labor rows, causing Bork-only venues to be skipped.)
  return VENUE_STRIP_LOCATIONS.map(v => v.locationId)
}
```

- **Metadata header (lines 1–30):** Add/update documentation if exists
- **Code comment (inline):** Explain why we hardcode (prevents venue-dependent silently-missing snapshots)

---

#### **1c. Add Verbose `DEBUG` Logging in Critical Path**
**File:** `server/services/dailyOpsSnapshotService.ts` — in `buildDailyOpsSnapshot()`:
```typescript
// After location discovery
if (String(process.env.DEBUG ?? '').includes('snapshot:build')) {
  console.info(`[snapshot:build] ${businessDate} → building ${locations.length} venues: ${locations.join(', ')}`)
}
```

**Why:** When developers run a manual snapshot rebuild, they immediately see which venues were picked — prevents silent skips.

---

### **Phase 2 — Sweep All Metadata Headers (Prevent Future Drift)**

**Scope:** All files in `server/utils/dailyOpsSnapshot/` that reference Bork/Eitje collections or @architecture.

**For each file:**
1. Check `@architecture` section — does it mention `bork_business_days` (no suffix)?
   - If yes, update to `bork_business_days_v2` or document the suffixed-read pattern
2. Check `@last-modified` — is it >2 weeks old?
   - If yes, you've likely drifted (migration, new feature, new callers) → update it
3. Run the function/code locally and verify:
   - What collections does it actually read/write?
   - Do the metadata names match the code?

**Files to audit (33 total, high priority):**
- ✗ `resolveSources.ts` (DONE above, 1a)
- `buildRevenueSection.ts` — reads `bork_business_days_v2` (suffix OK), but metadata?
- `buildLaborSection.ts` — reads `eitje_time_registration_aggregation`
- `buildPeriodBreakdown.ts` — reads drilldown data (what's the source?)
- `drilldown/buildRevenueDrilldownHourly.ts` — reads `input.hourly` (paid-time slots)
- `dashboardBundle/hourBundle.ts` — merges hourly snapshots
- `fetchDashboardBundle.ts` — orchestrates dashboard build (what does it call?)
- + 26 more in the snapshot/ directory

**Workflow per file:**
```bash
1. Read top 20 lines (metadata header)
2. Scan for @architecture, @exports-to, @last-modified, @description
3. Search code for db.collection() calls
4. If metadata says X but code reads Y → UPDATE METADATA + ADD JIRA COMMENT
5. Update @last-modified to today's date (2026-07-13)
6. Add @last-fix explaining what was corrected
7. Commit with message: "metadata: sync [filename] collection + architecture docs"
```

**Priority order (highest impact first):**
1. `resolveSources.ts` (already fixed in 1a)
2. `dailyOpsSnapshotService.ts` (already fixed in 1b)
3. `buildRevenueSection.ts`
4. `buildLaborSection.ts`
5. `fetchDashboardBundle.ts`
6. `drilldown/buildRevenueDrilldownHourly.ts`
7. All others in order

---

### **Phase 3 — Remove/Archive Obsolete Scripts & Confusing Code**

#### **3a. Delete Old Inspection Scripts**
- `scripts/inspect-bork-vat-shape.ts` — check if anyone depends on this output (grep codebase)
- `scripts/inspect-id-types.ts` — same
- `scripts/inspect-vat-coverage.ts` — same
- `scripts/backfill-bork-vat-fields.ts` — check git log for last run date; if >6 months, archive to `dev-docs/archived-scripts/`

**Action per script:**
```bash
git log --oneline -- scripts/script-name.ts | head -5
# If last commit >6 months old AND not in pipeline:
mv scripts/script-name.ts dev-docs/archived-scripts/
git add -A && git commit -m "chore: archive unused inspection script [script-name.ts]"
```

---

#### **3b. Decide: Drop `bork_business_days` Collection Entirely**

**Current state:**
- 240 docs, dates 2026-02-16 to 2026-05-11 (8 weeks old)
- All live data in `bork_business_days_v2` (1655 docs, 2024–2026)
- Collection exists only because migration was incomplete

**Options:**
1. **Drop it now** (recommended):
   - One-line Mongo command to delete the collection
   - Forces all future code to use `_v2`
   - Prevents accidental rediscovery of wrong patterns

2. **Rename to `bork_business_days_OLD_ARCHIVE`:**
   - Keeps data for historical inspection (lower risk)
   - Still obvious to devs that it's not the live source
   - Requires `listLocationIdsForDate()` to be fixed anyway

**Recommendation:** **Option 1 — drop it now.** The code is wrong if it reads the old table; fixing it now is the safety valve.

---

### **Phase 4 — Verify Hourly Basis Consistency (Existing Fix in Prior Plan Still Valid)**

- Keep the existing Phase 2 from prior build plan: shared `resolveHourlyRevenueBasis.ts`
- Today = order-time, all other days = paid-time
- Apply consistently to:
  - `buildHourlyRows()` (drilldown table)
  - `buildPeriodBreakdown()` (venue-strip Graph view)
  - `buildProfitByIntervalFromSnapshotHourly()` (profit by hour card)
  - `revenueByTimePeriodFromHourTotals()` (time-period breakdown)
  - Dashboard hourly chart (today's hourly tile)

**Status:** Unchanged from prior plan; Phase 1–3 above are **prerequisites** to ensure snapshots exist in the first place.

---

### **Phase 5 — Ops-Notifications Detection (Existing Fix in Prior Plan Still Valid)**

- Add detectors for:
  - `snapshot_venue_coverage_incomplete` (N/3 venues missing for a date)
  - `read_cache_stale` (snapshot newer than read-cache)
  - `hourly_basis_mismatch` (hourly sum ≠ headline)
- Enable auto-retry by default (every 30 min)

**Status:** Unchanged from prior plan; now will work **reliably** because Phase 1–3 guarantee all 3 venues are always attempted.

---

## Child Pages / Components Check

**Pages consuming dashboard-bundle + hourly data:**
1. `pages/daily-ops/index.vue` → `DailyOpsHomeDashboard.vue`
   - Uses `periodBreakdown` from bundle → Chart shows paid-time for historical, order-time for today (after Phase 4)
2. `pages/daily-ops/revenue.vue` → Revenue page (?)
   - Check if it reads from bundle or has direct API calls
3. `pages/daily-ops/productivity.vue` → Productivity (?)
4. `pages/daily-ops/sales/index.vue` → Sales (?)

**Action:** After Phase 1–3 are deployed, spot-check these pages to ensure hourly data matches headline totals (Phase 4 will enforce this).

---

## Live Data Validation Checklist (Against Current Data)

- [✓] Confirmed: `bork_business_days` has 0 docs for dates ≥ May 12, 2026
- [✓] Confirmed: `bork_business_days_v2` has current data (2026-07-12 has 3 venues)
- [✓] Confirmed: Kinsbergen had 6 Eitje rows on 2026-07-12 (exists in snapshot now)
- [✓] Confirmed: Kinsbergen had 0 Eitje rows at some point today → would have been skipped by old logic
- [✓] Confirmed: `resolveSources.ts:42` would have returned `borkCount=0` for today (reads empty table)
- [ ] **TO DO:** After Phase 1 fix, re-run `resolveSources()` and confirm `borkCount>0` for 2026-07-12

---

## Summary of Changes

| Phase | File(s) | Change | Lines | Risk | Impact |
|-------|---------|--------|-------|------|--------|
| **1a** | `resolveSources.ts` | Use `resolveBorkAggReadSuffix()` + update metadata | 42,46,92 | Low | Fixes provenance tracking (was always 0) |
| **1b** | `dailyOpsSnapshotService.ts` | Hardcode `VENUE_STRIP_LOCATIONS`; drop Eitje fallback | 177–186 | Low | **Fixes Kinsbergen silently skipped** |
| **1c** | `dailyOpsSnapshotService.ts` | Add DEBUG log for venue selection | inline | None | Debugging visibility |
| **2** | 33 files in `snapshot/` | Sync @architecture metadata to actual code | headers | None | Future-proofs codebase |
| **3a** | `scripts/` | Delete/archive obsolete inspection scripts | — | None | Removes confusion |
| **3b** | MongoDB | Drop `bork_business_days` collection | — | Low | Prevents accidental re-use |
| **4** | 6 files (Phase 2 from prior plan) | Shared hourly-basis resolver | — | Medium | Fixes hourly chart bug (Kinsbergen bars missing) |
| **5** | 5 files (Phase 4 from prior plan) | Add ops-notification detectors + enable auto-retry | — | Medium | Autodetects + self-heals future gaps |

---

## Deployment Order

1. **Phase 1a–1c** → Code-only, safe to deploy immediately (no config/schema changes)
2. **Phase 2** → Documentation-only, safe any time
3. **Phase 3a** → Delete scripts, safe (not in pipeline)
4. **Phase 3b** → Drop collection, **do after Phase 1a deployed** (verification step that no code reads old table)
5. **Phase 4–5** → Continue per original plan, now on solid foundation

---

## Verification (Post-Deploy)

```bash
# After Phase 1a–1c:
curl -s 'http://localhost:8080/api/daily-ops/snapshot.get?businessDate=2026-07-12' \
  | jq '.sections.revenue.sources.bork.collection'
# Expected: "bork_business_days_v2" (or similar, NOT "bork_business_days")

# After Phase 1b:
curl -s 'http://localhost:8080/api/daily-ops/metrics/venue-strip?date=2026-07-12' \
  | jq '.venues[] | select(.locationId=="69d6cfa63d2adf93b79d1ae7") | .revenue'
# Expected: €1,894+ order-time revenue for Kinsbergen (was: nothing)

# After Phase 2:
git log --oneline -- server/utils/dailyOpsSnapshot/*.ts | grep metadata | wc -l
# Expected: >10 commits updating metadata
```

---

## Why This Matters (User's Frustration)

> "unacceptable, that code just decides to not write anything, eventhough we have bork data!!!!"

**Root cause:** `listLocationIdsForDate()` queries the **wrong, empty table** (`bork_business_days`), then falls back to Eitje labor rows. When a venue has no Eitje labor for that day (timing, holiday, or sync lag), the snapshot build is silently skipped — even though Bork has revenue data.

**This plan fixes it by:**
1. Stopping the wrong query immediately (Phase 1b)
2. Using a hardcoded, **always-complete** venue list (never silently skip a venue)
3. Adding observability (Phase 1c debug log) so when it fails in the future, you see which venues were attempted
4. Adding automated detection (Phase 5) so gaps are caught + auto-healed within 30 min

**Metadata madness (Phase 2):** Old docs point at wrong tables. By syncing metadata headers to actual code, the codebase becomes self-documenting — new devs won't pick the wrong table.

