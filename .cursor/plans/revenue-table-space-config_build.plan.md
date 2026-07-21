---
name: revenue-table-space-config
overview: Location-scoped revenue space mapping (Restaurant/Bar/Terras/Parkeer/etc.) with editable modal config UI, API persistence, and 60-day snapshot rebuild. Uses DB config + defaults with fallback to hardcoded locationSpaces.ts. **STATUS: DONE.**
todos:
  - id: data-model
    content: "Add location.revenue_spaces field (Mongo doc: {id, name, tableRanges: [{min,max}], individualTables: []})"
    status: completed
  - id: api-routes
    content: "API: GET /api/locations/:id/revenue-spaces (load/seed), PUT (replace-all spaces + optional rebuild), POST /api/daily-ops/snapshot/rebuild-spaces (body: {locationId, days})"
    status: completed
  - id: builder-snapshot
    content: "buildRevenueTablesSection + buildRevenueDrilldownSpaces use locationSpaceResolver; wired → read-cache dashboard-bundle"
    status: completed
  - id: snapshot-rebuild
    content: "POST /api/daily-ops/snapshot/rebuild-spaces rebuilds selected + all venue-strip locations for last 60 days (sync, not queued)"
    status: completed
  - id: modal-ui
    content: "DailyOpsRevenueSpaceConfigModal.vue: draft add/edit/delete + Save (PUT config) / Save & Rebuild Last 60 Days"
    status: completed
  - id: card-integration
    content: "Info icon on DailyOpsRevenueSpaceTable.vue header → modal; auto-picks location from dashboard query or defaults to first"
    status: completed
  - id: seed-defaults
    content: "Lazy seed-if-empty from locationRevenueSpaceDefaults.ts (default IDs for Kinsbergen/Bar Bea/L'Amour); no scripts/ deploy script"
    status: completed
  - id: verify-rebuild
    content: "Manual QA: edit a space name → Save & Rebuild 60d → verify snapshot/card updates for last 60 days without total drift"
    status: completed
isProject: false
---

# Revenue Table Space Config — Actual Implementation

## Problem
- Table → space mapping was hardcoded in `server/utils/dailyOpsRevenue/locationSpaces.ts` (single-venue).
- Each location (Kinsbergen, Bar Bea, L'Amour) has different table ranges → different spaces.
- "Revenue Per Space" card was empty until manual code edit.

## Solution Status: **DONE**
✅ **Completed:**
- Location-scoped Mongo config (`revenue_spaces` field).
- GET + PUT API (no POST/`/:spaceId` CRUD — UI uses replace-all PUT).
- `locationSpaceResolver.ts` reads DB config + defaults with fallback to hardcoded.
- Snapshot builders (`buildRevenueTablesSection`, `buildRevenueDrilldownSpaces`) use resolver.
- Data flows into dashboard read-cache (`daily_ops_read_cache` · `dashboard-bundle`).
- Modal UI with location context; space draft add/edit/delete.
- Lazy seed-if-empty from defaults (not deploy script).
- Rebuild endpoint (60d, sync, all venue-strip locations + selected).
- Verify-rebuild signed off (no further QA).

---

## Architecture (Actual)

### Data Model
Stored on `locations` collection (unified peer IDs via `locationUnifiedIdResolver.ts`):
```ts
revenue_spaces: Array<{
  id: string                                   // e.g. "restaurant", "bar"
  name: string                                 // display name
  tableRanges: { min: number; max: number }[] // e.g. [{1, 40}, {152, 154}]
  individualTables: number[]                   // sparse; rarely used
}>
```

**Defaults (3 venues):** `locationRevenueSpaceDefaults.ts`  
- Kinsbergen: restaurant, bar, terras, overig
- Bar Bea: similar
- L'Amour: similar

### API Routes (Actual)
| Method | Path | Body | Returns |
|--------|------|------|---------|
| **GET** | `/api/locations/:id/revenue-spaces` | — | `{ locationId, locationName, spaces, seeded }` |
| **PUT** | `/api/locations/:id/revenue-spaces` | `{ spaces, rebuildDays? }` | Result after update; auto-appends `overig` if missing |
| **POST** | `/api/daily-ops/snapshot/rebuild-spaces` | `{ locationId, days? }` | Status; rebuilds **selected + all venue-strip IDs** (not query-string) |

**Not in API:** per-`spaceId` POST/PUT/DELETE (modal does draft add/edit/delete, then replace-all PUT).

### Resolution Order (`loadLocationRevenueSpaces`)
1. DB `locations.revenue_spaces` (org/unified peer ID)
2. → Else `locationRevenueSpaceDefaults` (optionally **written** to Mongo if `seedIfEmpty: true`)
3. → Else `getLocationSpaceForTable()` in `locationSpaces.ts` (legacy fallback; single-venue hardcode)

**Snapshots store** resolved **space display names** in `table.locationSpace` (string), not IDs. Lookup → store name → read-cache reads name.

---

## Files (Actual Implementation)

### API Routes
- `server/api/locations/[id]/revenue-spaces.get.ts` — load (+ lazy seed)
- `server/api/locations/[id]/revenue-spaces.put.ts` — replace-all
- `server/api/daily-ops/snapshot/rebuild-spaces.post.ts` — rebuild last N days

### Server Utils
- `server/utils/locationSpaceResolver.ts` — resolve table ID → space name (DB → defaults → fallback)
- `server/utils/locationUnifiedIdResolver.ts` — org ID ↔ Bork/venue-strip unified ID
- `server/utils/locationRevenueSpaceDefaults.ts` — hardcoded defaults for 3 venues
- `server/utils/dailyOpsSnapshot/buildRevenueTablesSection.ts` — calls resolver; stores `locationSpace` in snapshot rows
- `server/utils/dailyOpsSnapshot/drilldown/buildRevenueDrilldownSpaces.ts` — aggregates sealed snapshot `locationSpace` → space rows (for display, not recalc)
- `server/utils/dailyOpsSnapshot/buildRevenueDrilldownSection.ts` — wires hourly + spaces + top-10 → DTO
- `server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts` — orchestrates bundle → **writes to `daily_ops_read_cache`** (ADR-013 write-path SSOT)

### Types
- `types/location-revenue-spaces.ts` — `LocationRevenueSpace` interface (SSOT; no `types/locations.ts`)
- Data attached to `DailyOpsRevenueBreakdownDto` (via drilldown section)

### UI Components
- `components/daily-ops/DailyOpsRevenueSpaceConfigModal.vue` — add/edit/delete spaces in draft; Save PUT or Save & Rebuild
- `components/daily-ops/DailyOpsRevenueSpaceTable.vue` — info icon → modal
- `components/daily-ops/DailyOpsRevenueDrilldownSection.vue` → `DailyOpsRevenueMetricsSection.vue` — parent; wires location from dashboard query

---

## Data Flow (Snapshot + Read-Cache)

```
buildDailyOpsSnapshot()
  ↓
  buildRevenueTablesSection()
    ↓ resolveLocationSpace() [locationSpaceResolver]
    ↓ stores table.locationSpace (name string)
    ↓ snapshot row: {table, locationSpace: "Restaurant", ...}
  ↓
  buildRevenueDrilldownSection()
    ↓ buildRevenueDrilldownSpaces() [reads sealed snapshot rows, aggregates by name]
    ↓ returns spaces array for DTO
  ↓
  buildDailyOpsRevenueBreakdownDto()
    ↓ DailyOpsRevenueBreakdownDto { hourly[], spaces[], top10{} }
  ↓
  fetchDashboardBundle() [orchestrator]
    ↓ writes to daily_ops_read_cache · dashboard-bundle
  ↓
  GET /api/daily-ops/metrics/bundle (read-cache HIT)
    ↓ DailyOpsRevenueMetricsSection renders space rows + modal
```

**Modal → PUT config** → next snapshot rebuild writes new space names → read-cache updates automatically.

---

## How UI Wires Config

1. **Route query:** Dashboard `/daily-ops?location=<locationId>` → `useDailyOpsDashboardRoute().dashboardQuery.location`
2. **Pass down:** `DailyOpsRevenueMetricsSection` → `DailyOpsRevenueDrilldownSection` (primary location context)
3. **Modal:** `initialLocationId` from parent; fallback if null = first location from GET `/api/locations`
4. **Location select:** Modal can change location to edit any venue
5. **Save:** PUT config only (persists to Mongo)
6. **Save & Rebuild:** PUT + POST rebuild-spaces (rebuilds 60d for that location + all strip venues; triggers next snapshot build)
7. **Refresh:** `@configSaved` → parent `refresh()` → re-fetch read-cache

---

## Remaining Work: none

**verify-rebuild** marked completed (user sign-off; no further QA).

---

## Gotchas & Design Notes

1. **Save ≠ Rebuild:** PUT config persists immediately; rebuild is opt-in "Save & Rebuild" button (separate POST call).
2. **Rebuild is not queued:** POST rebuilds synchronously; may take seconds/minutes. UI does not block, but should show spinner.
3. **Rebuild scope:** Rebuilds **selected location + all `VENUE_STRIP_LOCATIONS`** (intentional: keeps all venues in-sync).
4. **`rebuildDays` on PUT ignored:** Plan shows `rebuildDays` in body; actual PUT doesn't use it (rebuild is separate POST).
5. **`locationSpaces.ts` is last-resort only:** Once DB has config, hardcode has no effect (unless DB config is deleted + no defaults).
6. **Lazy seed-if-empty:** GET can **mutate** Mongo (writes defaults if collection/field empty). Not a one-shot deploy script.
7. **Function registry empty:** `function-registry.json` currently has no tracked functions for this feature; relying on naming/folder convention only.

---

## Safe Implementation Path

### ✅ Already Done (Do Not Repeat)
- Phases 1–3 of old plan (data model, API, builders) — **fully shipped; refactoring would break working code**.
- **DO NOT:**
  - Add per-`spaceId` POST/PUT/DELETE routes (conflicts with existing replace-all PUT).
  - Write a deploy seed-script (overwrites user edits; use lazy seed-if-empty pattern).
  - Move `buildRevenueDrilldownSpaces.ts` (already correct location: `drilldown/`).
  - Put schema on `types/locations.ts` (SSOT is `types/location-revenue-spaces.ts`).

### ✅ Verify-Rebuild
Signed off — no further QA.

---

## Links to Code
- API: `/server/api/locations/[id]/revenue-spaces.*`
- Resolver: `server/utils/locationSpaceResolver.ts`
- Rebuild: `server/api/daily-ops/snapshot/rebuild-spaces.post.ts`
- Builders: `server/utils/dailyOpsSnapshot/{buildRevenueTablesSection, buildRevenueDrilldownSection, drilldown/buildRevenueDrilldownSpaces}.ts`
- Modal: `components/daily-ops/DailyOpsRevenueSpaceConfigModal.vue`
- Rule: `.cursor/rules/daily-ops-revenue-drilldown.mdc` (snapshot-first constraint applies)
