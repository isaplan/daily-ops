# Architecture Decision Records (ADR)

Append-only log of locked decisions. When changing behavior that contradicts an ADR, add a new ADR that supersedes the old one — do not edit history in place.

**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [ROADMAP.md](./ROADMAP.md)

---

## ADR-001 — Members are SSOT for current compensation

**Status:** Accepted (2026-05-16)

**Context:** `GET /api/members/[id]` fell back to `inbox-eitje-contracts` when `cost_per_hour` was missing, creating two display truths.

**Decision:** `members` holds current `contract_type`, `hourly_rate`, `cost_per_hour` (denormalized from the latest open revision). APIs and UI read compensation from `members` only. Inbox contract rows are input/audit, not a runtime fallback.

**Consequences:** Missing rates return `compensation_status: 'missing'`. Eitje staff hub shows a dedicated block for members missing compensation data.

---

## ADR-002 — Forward-only effective dating (detection date)

**Status:** Accepted (2026-05-16)

**Context:** Eitje does not expose reliable metadata for when a wage change took effect in the past.

**Decision:** New revisions use `effective_from = contract_start_date` from the import row when present, else `importedAt` (detection date). No retroactive rebuild of `eitje_time_registration_aggregation` or `daily_ops_snapshot*` in v1.

**Consequences:** Historical labor cost in snapshots reflects rates known at aggregation time. Manual “effective from date X” with scoped rebuild is deferred (see ROADMAP).

---

## ADR-003 — `members.unified_user_id` is the canonical cross-system FK

**Status:** Accepted (2026-05-16)

**Context:** Fuzzy matching (`support_id`, name, `eitjeIds`) caused duplicate resolution paths and partial joins.

**Decision:** Every `members` document should store `unified_user_id` (ObjectId → `unified_user._id`). Aggregation and cross-system features use this FK first; fuzzy resolution is admin/repair-only when FK is null.

**Consequences:** Eitje sync maintains the link. Backfill script seeds existing members.

---

## ADR-004 — Snapshots are the only dashboard read source

**Status:** Accepted (2026-05-16)

**Context:** Live `$lookup` pipelines on each dashboard load were slow and inconsistent.

**Decision:** Daily Ops home and bundle metrics read `daily_ops_snapshot` + `daily_ops_snapshot_section_*` only. UI performs no aggregation math on raw or inbox collections.

**Amendment (2026-06-18):** Headline **totals** (revenue, labor hours, labor cost) must reconcile across KPI tiles, venue strip, and profit-by-time-of-day for any period. Hourly *shape* may differ ≤10% for visualization; rolled-up totals may not.

**Consequences:** Snapshot rebuilds are event-driven (Bork/Eitje sync, inbox seal). Writers never read raw collections.

---

## ADR-005 — Idempotent compensation revisions

**Status:** Accepted (2026-05-16)

**Context:** Re-importing the same contract CSV must not spam revision history.

**Decision:** Open a new revision only when `contract_type`, `hourly_rate`, or `cost_per_hour` (material fields) change vs the latest open revision.

**Consequences:** `materialFieldsChanged()` guard in `server/utils/memberCompensationRevisions.ts`.

---

## ADR-006 — Hot / warm / cold data tiers

**Status:** Accepted (2026-05-24)

**Context:** Revenue and dashboard loads timed out because read paths scanned Bork/Eitje aggregates per day while raw and fat aggregate collections duplicated snapshot data. Mongo on DO should stay small; raw is immutable after seal.

**Decision:**

| Tier | What | Retention | UI reads? |
|------|------|-----------|-----------|
| **Hot** | `daily_ops_snapshot*` + precomputed `daily_ops_revenue_benchmark` | 2 years | **Yes — only source** for Daily Ops / Revenue overview |
| **Warm** | `bork_business_days`, `eitje_time_registration_aggregation`; fat `bork_sales_by_*` during pipeline | Day-level **2 years**; fat slices **until snapshot sealed** then delete per day | **No** on GET (writers + backfill jobs only) |
| **Cold** | DO Spaces blobs: `bork/{locationId}/{businessDate}.json.gz`, `eitje/{locationId}/{businessDate}.json.gz` | Indefinite | On-demand rebuild jobs only |

Additional rules:

- **Eitje shift raw** follows the same blob-and-delete policy as Bork raw. Eitje master-data endpoints (`users`, `teams`, `environments`) stay in Mongo.
- **No duplicate serving shapes:** once revenue hourly is in snapshot, `bork_sales_by_hour` for that day is dropped from Mongo.
- **60-day window** = benchmark precompute + backfill completeness SLA — not an analytics cutoff.
- **90-day optional grace** in Mongo for shift/line drill-down before raw purge; older → rebuild from blob (async job).
- Revenue overview must not call live Bork aggregation on request; missing snapshot → partial response / backfill queue.

**Consequences:** Implement per [dev-docs/DATA_RETENTION_PLAN.md](./dev-docs/DATA_RETENTION_PLAN.md). ADR-004 read rule unchanged; ADR-006 adds retention and purge rules.

---

## ADR-007 — Sealed snapshot write guard + headline scaling for sub-sections

**Status:** Accepted (2026-06-05)

**Context:** Fat Bork slices (`bork_sales_by_hour`, `bork_sales_by_product`, `bork_sales_by_table`, `bork_sales_by_worker`, `bork_sales_by_order_hour`, `bork_sales_by_order_worker`) are purged from Mongo after snapshot seal (ADR-006). If `buildDailyOpsSnapshot` was triggered again after purge (e.g. a backfill, labor sync, or space-config rebuild), the newly built fat sections would be empty and overwrite the original sealed data — destroying hourly and breakdown detail permanently.

Additionally, the workers and tables sections stored raw Bork numbers without applying the Inbox morning-final headline scale factor. This caused the workers/tables totals to disagree with the sealed revenue headline by the Bork vs Inbox discrepancy.

**Decision:**

1. **Write guard:** Before writing each fat section (`revenueHourly`, `revenueProducts`, `revenueTables`, `revenueWorkers`, `revenueByOrderTime`) for a sealed (`status: 'final'`) snapshot, check whether the new build produced any non-zero data. If empty (Bork slices were purged), skip the upsert. `revenueSection` and `laborSection` are always safe to rewrite (Inbox headline + `eitje_time_registration_aggregation` persist after seal).

2. **Headline scaling:** `buildRevenueSection` is always run first to resolve `totals.ex_vat` (Inbox headline). That value is passed as `headlineExVat` to `buildRevenueWorkersSection` and `buildRevenueTablesSection`, which scale all worker/table revenues proportionally when the Bork aggregate total differs from the Inbox headline by more than 0.1%. `buildRevenueProductsSection` already uses `inbox.sections.netto_sales.categories` directly as SSOT for sealed days — no change needed there.

3. **Backfill endpoint:** `POST /api/daily-ops/snapshot/backfill-range` — rebuilds all venue snapshots over an arbitrary date range. The write guard ensures sealed days with existing data are not degraded.

**Consequences:**

- Snapshot rebuilds after Bork purge are safe and idempotent for sealed days.
- Workers and tables totals now reconcile with the Inbox headline revenue.
- Year-to-date backfill via the new endpoint refreshes revenue section + labor section without touching already-good hourly/products/tables/workers data on sealed days.

**Amendment (2026-06-18):**

4. **Reopen on fresher warm tier:** When `sources.*.lastSyncAt` is newer than `master.lastBuiltAt`, or `forceReopenSealed` is set (cron backfill / range rebuild), fat sections may be rewritten if the new build has data.
5. **Preserve on empty rewrite:** When sealed and warm tier is not newer, copy existing fat sections into the new build before write — including `revenueSection.hourly` (was being wiped while `revenueHourly` was preserved).
6. **Totals invariant:** Profit-by-interval period totals must reconcile with headline revenue/labor (see ADR-004 amendment).

---

## ADR-008 — Cascading JSON Cache for Instant Historical Loads

**Date:** 2026-06-05
**Status:** ✅ Implemented

**Context:** Historical day navigation (yesterday, last week, last month) was slow (~200-500ms per page) due to on-demand snapshot queries and aggregation. Users expect instant loads for sealed data that rarely changes.

**Decision:**
Pre-generate static JSON files for dashboard bundles in a cascading hierarchy:
- **Daily** → Generated from `daily_ops_snapshot_*` after build/seal
- **Weekly** → Aggregated from 7 daily files (ISO weeks W01-W53)
- **Monthly** → Aggregated from all daily files in month
- **Yearly** → Aggregated from 12 monthly files

API endpoint (`bundle.get.ts`) intelligently serves from the appropriate cache level based on query range, falling back to dynamic DB fetch if no cache exists.

**Benefits:**
- ✅ **10-200x faster** page loads for historical data (20-50ms vs 200-500ms+)
- ✅ **Browser/CDN caching** via aggressive HTTP headers (`immutable`, `max-age=86400`)
- ✅ **Automatic generation** after snapshot builds (zero manual work)
- ✅ **Flexible queries** via smart cache level selection
- ✅ **Scalable** to multi-month/multi-year dashboards without DB load

**Consequences:**
- Additional disk usage: ~500KB per 30 days (daily) + ~50KB (aggregated levels)
- Cache must be regenerated if historical snapshots are backfilled
- Complex queries (non-standard ranges) still require dynamic aggregation

**Amendment (2026-06-18):**
- Weekly/monthly/yearly aggregation **must merge** `profitByInterval` and `drilldown` (top-10, spaces, hourly) from daily bundles (never null totals while headline exists).
- Composed bundles include `snapshotCoverage` (`daysFound`, `missingDates[]`) and UI warning when partial.
- `bundle.get.ts` rejects cached bundles where profit-by-interval is empty but headline revenue > 0 (falls back to live Mongo read).

**Implementation:**
- `server/utils/dailyOpsSnapshot/aggregateDailyBundles.ts` — Aggregation math
- `server/utils/dailyOpsSnapshot/cacheCascade.ts` — Weekly/monthly/yearly generation
- `server/utils/dailyOpsSnapshot/preGenerateBundleCache.ts` — Daily cache generation
- `server/services/dailyOpsSnapshotService.ts` — Auto-trigger on build/seal
- `server/api/daily-ops/metrics/bundle.get.ts` — Smart cache serving
- `scripts/pregenerate-dashboard-bundles.ts` — Manual CLI tool

**Related:** ADR-004 (snapshot-only reads), ADR-006 (hot/warm/cold tiers)
**Docs:** `dev-docs/CACHE_CASCADE.md`

---

## ADR-009 — Eitje Data Architecture: API as SSOT for Hours, Inbox for Contracts

**Date:** 2026-06-06  
**Status:** ✅ Implemented

**Context:**
- Eitje API (hourly sync) provides real-time shift data but limited contract info
- Morning inbox email provides final approved hours + complete contract data (hourly_rate, contract_type, support_id)
- Inbox limitation: Only shows **approved** hours (excludes pending/unapproved shifts)
- Staff endpoint was reading from empty `inbox-eitje-contracts` collection
- Members collection serves as unified staff profile SSOT but wasn't being enriched from all sources

**Decision:** **Option B Architecture**

1. **Eitje API = SSOT for hours** (real-time, includes pending shifts)
   - `eitje_raw_data` → `eitje_time_registration_aggregation`
   - Used for: Today's dashboard, hour tracking, all shift activity

2. **Inbox = SSOT for contracts** (enriches members with wages/contracts)
   - `inbox-eitje-hours` contains both hours AND contract data per row
   - Used for: Contract/wage updates, validation, historical corrections

3. **Members collection = Unified staff profiles**
   - Enriched from BOTH API + inbox
   - Used by: Aggregations for cost calculations, staff management UI

**Benefits:**
- ✅ **Real-time accuracy:** API includes pending shifts (today's view)
- ✅ **Contract completeness:** Inbox provides accurate wages/contracts
- ✅ **Validation layer:** Cross-check API vs inbox for discrepancies
- ✅ **Manual control:** Ops alerts flag issues for intervention
- ✅ **Flexibility:** Retroactive updates via inbox re-processing

**Consequences:**
- Staff with recent shifts but missing contract data will trigger ops alerts
- Inbox-only staff (no API activity) indicate sync issues
- Contract updates happen daily via morning email (not real-time)

**Implementation:**

### Core Changes:
1. **`server/api/daily-ops/eitje-staff.get.ts`**
   - ✅ Read from `members` collection (SSOT)
   - ✅ Enrich with API activity (`eitje_time_registration_aggregation` last 30 days)
   - ✅ Show data source indicators + missing data flags

2. **`server/services/dataMappingService.ts`**
   - ✅ Apply contract data from `inbox-eitje-hours` rows to members
   - ✅ Both 'contracts' and 'hours' document types update members

3. **`server/api/daily-ops/eitje-staff-refresh-from-inbox.post.ts`**
   - ✅ Manual endpoint to re-process current month inbox data
   - ✅ Supports retroactive contract updates

### Ops Notifications:
4. **`server/utils/opsNotifications/detectors/eitjeStaffData.ts`**
   - ✅ Alert: Staff in API but NOT in members (new staff)
   - ✅ Alert: Staff missing critical data (hourly_rate, contract_type, support_id)

**Related:** ADR-001 (member compensation), ADR-004 (snapshot reads)  
**Docs:** `EITJE_ARCHITECTURE_OPTION_B.md`

---

## ADR-010 — Register business day is SSOT for Daily Ops “today”

**Status:** Accepted (2026-06-07)

**Context:** Daily Ops repeatedly regressed to ISO calendar date (`calendarYmdInAmsterdam`, `new Date().toISOString().slice(0, 10)`) for “today” in venue strip, bundle cache, and live revenue paths. That breaks the register model: **business day N = 08:00 Amsterdam on calendar N through 07:59:59 on calendar N+1** (late-night spillover).

**Decision:**

1. **SSOT:** `utils/dailyOpsBusinessDate.ts` — `amsterdamOpenRegisterBusinessDateYmd()`, `registerBusinessDateForInstant()`, `isOpenRegisterBusinessDate()`.
2. **Daily Ops UI + GET paths** resolve periods and compare “today” only via register business_date. Query Mongo by `business_date`, never by ISO calendar “today”.
3. **Integration fetch** (Bork `ticket/day.json/{YYYYMMDD}`, Eitje cron windows) may use calendar dates for API params only — not for dashboard display.
4. **Ops guard:** `detectors/businessDayIsoMisuse.ts` flags forbidden patterns in Daily Ops read/UI directories on every scan.

**Consequences:** Venue strip / bundle / labor live paths must import from `dailyOpsBusinessDate.ts`. Violations surface as critical architecture alerts on `/ops-notifications`.

**Related:** ADR-004 (snapshot reads), `types/daily-ops-snapshot.ts` (business_date field semantics)

---

## ADR-011 — Revenue Nav V2: mode-first tab navigation

**Status:** Accepted (2026-06-08)  
**Branch:** `feat/revenue-nav-v2`

**Context:** The V1 revenue filter presents five `<select>` dropdowns for period groups (week, month, quarter, season, rolling). UX is opaque; compare is limited; daily register-day navigation doesn't exist on the revenue page.

**Decision:**

1. **Two-tier tab nav:** Primary bar selects `mode` (daily | weekly | monthly | quarterly | yearly | seasonal | menu | period). Secondary bar shows contextual child slots for that mode.
2. **URL is SSOT:** `?mode=daily&slot=today&location=&compare=0&pick=YYYY-MM-DD`. Deep-linkable; refresh-safe.
3. **Feature flag:** `runtimeConfig.public.revenueNavVersion` = `'v1'` (default) | `'v2'`. V1 frozen until V2 sign-off.
4. **Slot → date range:** Pure TS resolver in `utils/dailyOpsRevenueNavV2/resolveRange.ts`. All existing V1 period IDs reused where possible; new IDs (`w-2`, `w-3`, `m-YYYY-MM`) added for missing slots.
5. **ADR-004 unchanged:** GET paths read snapshots only. V2 only changes query → date-range mapping on the client.
6. **Compare mode:** When `compare=1`, child tabs become multi-select (max 4). Composable exposes `compareSlots[]`; charts receive multiple date-range series.

**Consequences:** `DailyOpsDashboardShell` conditionally renders `RevenueAnalyticsNavV2` on revenue routes when flag is `v2`. All V2 logic lives in `utils/dailyOpsRevenueNavV2/` and `composables/useDailyOpsRevenueNavV2.ts`.

**Related:** ADR-004, ADR-010, `dev-docs/REVENUE_NAV_V2_BUILD_PLAN.md`

---

## ADR-012 — Members ingest pipeline (Eitje master + CSV → members)

**Status:** Accepted (2026-06-29)

**Context:** ADR-001 and ADR-009 declared `members` as SSOT for staff profiles, but ingest stopped at `eitje_raw_data` / `unified_user`. Eitje master `active` and CSV contract end dates were stored but not applied. Staff UI used trailing 30-day hours as “active”, contradicting ops workflow (Eitje marks leavers inactive; CSV has contract end).

**Decision:**

1. **`members` = one HR profile per person** (staff roster, compensation, employment). **`unified_user` = ID resolver only** (Eitje/Bork/inbox IDs → `members._id`). No duplicate profile fields on `unified_user`.
2. **Every Eitje master sync** upserts all API users into `members` (`syncMembersFromEitjeMaster`). Sets `eitje_active` from API `active` flag.
3. **CSV / inbox** enrich `members` (contract, wage, `contract_end_date`) via revision util — input/audit collections are not runtime fallbacks (ADR-001 unchanged).
4. **`members.is_active` (employment)** = resolve from: manual override → contract end in past → `eitje_active` → default true. **Not** trailing shift hours.
5. **Notes / todos / chats:** `connected_member_ids` → `members._id`. `@mentions` / attendance may still reference `unified_user` until migrated; new links use `members`.

**Consequences:** `eitjeStaffHub` lists all `members`; inactive badge from employment. Master sync + `pnpm members:sync-eitje-master` required after deploy. Snapshot labor still reads contract from `members` at build time.

**Related:** ADR-001, ADR-003, ADR-009

---
