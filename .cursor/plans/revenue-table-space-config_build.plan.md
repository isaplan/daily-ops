---
name: revenue-table-space-config
overview: "Add editable location-scoped revenue space mapping (Restaurant/Bar/Terras/Parkeer/etc.) with modal config UI, API persistence, and 60-day snapshot rebuild trigger. Implements org-level control for table→space grouping used by Revenue Per Space card."
todos:
  - id: data-model
    content: "Add location.revenue_spaces field (Mongo doc: {spaceId, name, tableRanges: [{min,max}], individualTables: []})"
    status: completed
  - id: api-create-update
    content: "Create POST /api/locations/:id/revenue-spaces and PUT /api/locations/:id/revenue-spaces/:spaceId"
    status: completed
  - id: builder-refactor
    content: "Refactor buildRevenueTablesSection to read location space config from DB instead of hardcoded locationSpaces.ts"
    status: completed
  - id: snapshot-rebuild
    content: "Add rebuild endpoint POST /api/daily-ops/snapshot/rebuild-spaces that rebuilds last 60 days for a location"
    status: completed
  - id: modal-ui
    content: "Create DailyOpsRevenueSpaceConfigModal.vue with add/edit space forms, table range inputs"
    status: completed
  - id: card-integration
    content: "Add info icon + modal trigger to DailyOpsRevenueSpaceTable.vue header"
    status: completed
  - id: seed-defaults
    content: "Script to seed revenue_spaces on existing locations (Kinsbergen, Bar Bea, L'Amour) on first deploy"
    status: completed
  - id: verify-rebuild
    content: "Test rebuild for last 60 days, verify snapshot rows update with new space names"
    status: pending
  - id: monolith-split
    content: "Split assembleLaborDto + buildRevenueDrilldownHourly; extend MONOLITH_WATCH detector"
    status: completed
isProject: false
---

# Revenue Table Space Config Plan

## Problem
- Table → space mapping is hardcoded in `server/utils/dailyOpsRevenue/locationSpaces.ts` (only works for one venue).
- Each location (Kinsbergen, Bar Bea, L'Amour) has different table ranges → different spaces.
- "Revenue Per Space" card shows empty state until mapping is defined.
- Currently no UI to edit space config; changes require code edit + rebuild.

## Solution
1. **Store config per location** in `locations.revenue_spaces` (Mongo).
2. **API to CRUD spaces & table ranges** (POST, PUT, DELETE).
3. **Rebuild snapshots** for last 60 days when config changes.
4. **Modal UI** on Revenue Per Space card with info icon.
5. **Detect & flag monolithic files** during refactoring (see audit below).

---

## Architecture

### Data Model
```
Location doc:
{
  _id: ObjectId,
  name: "Kinsbergen",
  revenue_spaces: [
    {
      id: "restaurant",
      name: "Restaurant",
      tableRanges: [{min: 1, max: 40}, {min: 152, max: 154}],
      individualTables: []
    },
    {
      id: "bar",
      name: "Bar",
      tableRanges: [{min: 1001, max: 1030}],
      individualTables: []
    },
    ...
  ],
  ...
}
```

### API Routes
- **POST `/api/locations/:id/revenue-spaces`** → create space + ranges
- **PUT `/api/locations/:id/revenue-spaces/:spaceId`** → update space
- **DELETE `/api/locations/:id/revenue-spaces/:spaceId`** → delete space
- **POST `/api/daily-ops/snapshot/rebuild-spaces?locationId=X&days=60`** → async rebuild trigger

### Server Refactoring
- **Read phase:** `buildRevenueTablesSection` fetches location + `revenue_spaces`, replaces hardcoded `getLocationSpaceForTable()`.
- **Keep `locationSpaces.ts`** as fallback/reference for table ranges.
- **Separate concerns:** Move table-range-lookup logic to `server/utils/locationSpaceResolver.ts` (new, ~40 lines).

### UI Components
- **`DailyOpsRevenueSpaceConfigModal.vue`** (new, ~150 lines)
  - Form: add/edit space name, input table ranges (comma-sep or range syntax `1-40, 152-154`).
  - List: existing spaces with edit/delete buttons.
  - Action: "Save & Rebuild Last 60 Days" button.
- **`DailyOpsRevenueSpaceTable.vue`** (update, ~3 lines)
  - Add info icon in header → click opens modal.

---

## Code Quality Audit: Monolithic Files

### Critical (>500 lines)
- **`fetchDashboardBundle.ts` (808 lines)** 🚨 Orchestrator only; consider extracting builder wiring to separate file.
- **`buildRevenueDrilldownSection.ts` (401 lines)** 🚨 Mixes hourly/spaces/top-10 builders; extract `buildRevenueSpaces()` to `buildRevenueSpaces.ts` (~80 lines).
- **`buildLaborSection.ts` (213 lines)** Consider split if >250 after new logic.

### Large (150–250 lines) — Review Candidates
- **`borkRevenueRead.ts` (283 lines)** ⚠️ Query + aggregation logic; consider extracting `borkQueryBuilder.ts`.
- **`fetchRevenueRange.ts` (146 lines)** ⚠️ Hourly fetching; verify scope before adding space logic.

### Healthy (<150 lines)
- Most snapshot builders, revenue utilities ✅

### Refactoring Spike Tasks
1. **Split `buildRevenueDrilldownSection.ts`:**
   - Extract `buildRevenueSpaces()` → `buildRevenueSpaces.ts`
   - Extract `buildTop10()` → `buildRevenueTop10.ts`
   - Leave hourly builders in main; wire in `buildRevenueDrilldownSection.ts`.
   - **Est. 3 hours, do after space config MVP works.**

2. **Extract `fetchDashboardBundle.ts` orchestration:**
   - Create `wiredSnapshotBuilders.ts` = builder imports + exports.
   - Reduces `fetchDashboardBundle` by ~100 lines.
   - **Est. 2 hours, do in follow-up commit.**

---

## Implementation Path

### Phase 1: Data + API (1–2 hours)
1. Add `revenue_spaces` schema to Location type.
2. Create POST/PUT/DELETE space routes.
3. Create rebuild trigger route.

### Phase 2: Builder Refactor (2–3 hours)
1. Extract `buildRevenueSpaces.ts` from `buildRevenueDrilldownSection.ts`.
2. Create `locationSpaceResolver.ts` to read location config + fallback to hardcoded.
3. Update `buildRevenueTablesSection.ts` to use resolver.
4. Test snapshot rebuild for 60 days.

### Phase 3: UI (1–2 hours)
1. Create `DailyOpsRevenueSpaceConfigModal.vue`.
2. Add info icon to `DailyOpsRevenueSpaceTable.vue`.
3. Wire modal to location ID (from analytics context).

### Phase 4: Seed + Verify (30 min)
1. Seed defaults for all 3 locations on first deploy.
2. Manual test: edit a space, trigger rebuild, verify card updates.

---

## Agent Rules Compliance ✅

- **RULE #0.5:** Rebuild trigger logged; terminal checked for errors.
- **RULE #4:** Max ~100 lines per change; split monolithic builders first (separate commit).
- **RULE #11:** Metadata headers on new API routes + builders; `@exports-to` updated in wired files.
- **Small commits:** Phase 1–3 = one commit each (data + API; builders; UI).
- **No live Bork on GET:** Space resolution reads location config only.

---

## Files to Touch

### New
- `server/api/locations/[id]/revenue-spaces.post.ts`
- `server/api/locations/[id]/revenue-spaces/[spaceId].put.ts`
- `server/api/locations/[id]/revenue-spaces/[spaceId].delete.ts`
- `server/api/daily-ops/snapshot/rebuild-spaces.post.ts`
- `server/utils/locationSpaceResolver.ts`
- `server/utils/dailyOpsSnapshot/buildRevenueSpaces.ts` (extracted)
- `components/daily-ops/DailyOpsRevenueSpaceConfigModal.vue`

### Modify
- `types/locations.ts` (add `revenue_spaces` field)
- `server/utils/dailyOpsSnapshot/buildRevenueDrilldownSection.ts` (extract spaces builder, import `buildRevenueSpaces`)
- `server/utils/dailyOpsSnapshot/buildRevenueTablesSection.ts` (use resolver instead of hardcoded `getLocationSpaceForTable`)
- `components/daily-ops/DailyOpsRevenueSpaceTable.vue` (add modal trigger)

### Refactor (follow-up)
- `server/utils/dailyOpsSnapshot/buildRevenueDrilldownSection.ts` → extract top-10 builder after MVP ships
- `server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts` → extract wiring helpers after MVP ships

---

## Verification Checklist
- [ ] POST space creates revenue_spaces doc entry.
- [ ] PUT updates space name + ranges.
- [ ] DELETE removes space (cascade check: no in-flight snapshots).
- [ ] Rebuild trigger queues 60-day rebuild job.
- [ ] Rebuild completes: snapshots for location have new space names.
- [ ] Revenue Per Space card renders new space rows next day.
- [ ] Modal opens on info icon click (location ID from context).
- [ ] No compile errors after builder refactoring.
- [ ] No existing snapshot totals change (spaces are grouping only).
