# Architecture Decision Records (ADR)

Append-only log of locked decisions. When changing behavior that contradicts an ADR, add a new ADR that supersedes the old one — do not edit history in place.

**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [ROADMAP.md](./ROADMAP.md)

---

## ADR precedence (mandatory — every agent, every change)

**Read this before proposing or shipping any Daily Ops change.** Formula and feature ADRs are **not** free to invent a second read path or a second truth.

| Rank | Layer | ADRs | Non-negotiable rule |
|------|--------|------|---------------------|
| **1** | **Data plane** | **004 → 006 → 010 → 013** | Snapshots = write SSOT. Hot GET = **`daily_ops_read_cache` only** (ADR-013). Day → week → month → year cascade on **write**. Never live Bork/Eitje/inbox/snapshot assembly on page load. |
| **2** | **Truth & verify** | **020, 021** | Ops labor/revenue must reconcile to sealed Finance P&L (and inbox cross-checks). Silent drift is a bug. Self-heal + ops alerts required. |
| **3** | **Formula** | **014, 019, 022** | How profit / BE / Est. net are *calculated*. Must **plug into** ranks 1–2 (write → cascade → GET cache). Period composition is ADR-022. |
| **4** | **Domain** | 001–003, 005, 007, 009, 011–012, 015–018 | Members, Eitje, weekly reports, staff-org, UI nav, etc. Must not contradict ranks 1–3. |

### Why ADR-013 exists

UI must stay light on DigitalOcean. Assembling year/week/month metrics on every GET is slow and invents inconsistent rollups. **013** forces: prebuilt small JSON per profile/period; GET = `findOne`; miss = `dataGap` + rebuild job — **not** recompute-on-request. That is why BE, Est. net, labor %, and profit belong in the **cache cascade**, not in a clever GET handler.

### Compliance gate (new or amended ADRs)

Before accepting any ADR that touches Daily Ops metrics:

1. Name the **write path** (snapshot / Finance seal / assumptions refresh).
2. Name the **cache profile + cascade** (ADR-013) — or explicitly justify a one-release transitional GET with a supersede deadline.
3. Name the **GET path** = read-cache only.
4. If sealed Finance exists for the period → that number is truth (ADR-020 / ADR-022); live assumptions only for **open** periods.
5. List `Related:` with **at least ADR-004 and ADR-013** when the ADR affects dashboard/KPI reads.
6. Update `@adr-ref` + `@last-modified` / `@last-fix` on every file in the apply map (metadata RULE #11).

**If an ADR omits 013 on a Daily Ops GET surface → reject / supersede it.** ADR-019’s original delivery path failed this gate; ADR-022 corrects it.

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

**Amendment (2026-07-02):** GET paths read **precomputed read-cache JSON** (ADR-013) when present. Snapshots remain the **write** SSOT; read-cache is a derived, disposable layer. Missing read-cache → zeros / `dataGap` / ops notification — **not** live warm-tier aggregation on page load.

**Amendment (2026-07-11):** Integration cron **success requires all locations** (Bork: every `api_credentials` row must sync OK). Partial sync → `integration_sync_partial_failure` ops alert. **Self-healing loop:** `runOpsNotificationAutoRetry` re-runs the failed job, runs `materializeSnapshotGaps` for the job window, then `refreshDashboardBundleCache`. Snapshot-gap fixes also refresh read-cache after `buildDailyOpsSnapshot`. Gap scan includes the **open register day** (ADR-010), not calendar yesterday only.

**Amendment (2026-07-26):** Ops auto-retry is **on by default** in production (`ops-notifications:auto-retry` at :17/:47; opt out with `DISABLE_OPS_NOTIFICATION_AUTO_RETRY=1`). Partial Bork sync returns `ok=false` again (all locations required). Integration alerts use a **stable id** (`businessDate=active`) so streaks survive day rollover. Alert **auto-clears** when failed venues already have revenue coverage for the sync window (daily-data/inbox filled the gap) or when single-location retry patches `integration_cron_jobs.lastSyncDetail` to all-ok.

**Consequences:** Snapshot rebuilds are event-driven (Bork/Eitje sync, inbox seal). Writers never read raw collections. Failed syncs must not report `lastSyncOk: true`.

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
| **Hot** | `daily_ops_snapshot*` + precomputed `daily_ops_revenue_benchmark` + **`daily_ops_read_cache`** (small prebuilt JSON, ADR-013) | 2 years | **Yes — only source** for Daily Ops / Revenue / Staff GET paths |
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

**Superseded (2026-07-02) by ADR-013:** Period rollups (week/month/year) must **not** concatenate day-level PBI cells or full drilldown into parent JSON. Daily = detail; rollups = **totals only** (same small doc shape). Storage moves to Mongo read-cache collection; child pages get separate cache profiles.

**Implementation (transitional — see ADR-013 for target):**
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
5. **ADR-004 unchanged:** GET paths read prebuilt read-cache only (ADR-013). V2 only changes query → date-range mapping on the client.
6. **Compare mode:** When `compare=1`, child tabs become multi-select (max 4). Composable exposes `compareSlots[]`; charts receive multiple date-range series.

**Consequences:** `DailyOpsDashboardShell` conditionally renders `RevenueAnalyticsNavV2` on revenue routes when flag is `v2`. All V2 logic lives in `utils/dailyOpsRevenueNavV2/` and `composables/useDailyOpsRevenueNavV2.ts`.

**Related:** ADR-004, ADR-010, ADR-013, `dev-docs/REVENUE_NAV_V2_BUILD_PLAN.md`

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

**Related:** ADR-013 (light read-cache SSOT), ADR-001, ADR-003, ADR-009

---

## ADR-013 — Light read-cache: small hierarchical JSON in Mongo (all Daily Ops pages)

**Status:** Accepted (2026-07-02)  
**Supersedes:** ADR-008 amendment (2026-06-18) fat rollup merge; extends ADR-008 filesystem prototype

**Context:** Daily Ops must keep the **client light**. Snapshots in Mongo are the write SSOT but assembling bundles/timeseries on every GET is too slow (especially on DO). A filesystem `.cache/` layer was added for the dashboard only; it is wiped on deploy, was never extended to Staff/Revenue child pages, and period rollups incorrectly concatenated day-level chart payloads (PBI cells, drilldown) into multi‑MB year files — contradicting the totals-only hierarchy design.

**Decision:**

1. **Primary goal:** Prebuilt JSON on the server; browser receives **small, ready-to-render payloads**. No aggregation math on the client. GET handlers **read cache only** — never rebuild cache on request.

2. **Storage:** Mongo collection **`daily_ops_read_cache`** (hot tier, ADR-006). Local dev may mirror to `.cache/` for debugging; **production SSOT is Mongo**, not container disk.

3. **Document key:** `{ profile, level, key, locationId }` where:
   - `profile` — cache slice for a page/domain, e.g. `dashboard-bundle`, `staff-timeseries`, `staff-plusmin`, `revenue-timeseries` (extensible; one profile per child page or chart family)
   - `level` — `daily` | `weekly` | `monthly` | `yearly`
   - `key` — `YYYY-MM-DD`, `YYYY-Wxx`, `YYYY-MM`, or `YYYY`
   - `locationId` — venue id or `all`

4. **Hierarchy (wheelbarrow, not backpack):**
   - **Daily** — full detail needed for that day’s UI (drilldown, hourly, PBI for single-day views only).
   - **Weekly / monthly / yearly** — **same small shape as daily headlines**: summed totals (revenue, labor hours, labor cost, headcount, team buckets) + optional **child refs** (e.g. year doc lists 12 month keys; month doc lists week keys). **No** concatenation of per-day PBI cell arrays or full drilldown into parent docs.
   - Charts pick the **lowest level that fits**: year overview → yearly doc; month chart → monthly doc; week strip → weekly doc; today drilldown → daily doc.

5. **Write path:** After integration cron finishes snapshot materialization (`buildDailyOpsSnapshot*`), server writes/updates affected daily docs then cascades week → month → year **for each profile**. Intraday open register day refreshes on each cron; sealed days are immutable until warm-tier reopen.

6. **Read path:** API resolves period → cache key → `findOne` on `daily_ops_read_cache`. Miss → `dataGap` / partial zeros + ops notification; fix via snapshot/cache rebuild job, **not** live Mongo assembly on GET (ADR-004).

7. **Size budget:** Rollup docs target **few KB** (headline + venue strip + labor breakdown totals). Heavy detail stays in **daily** profile docs or separate **sub-profiles** per child page when needed.

8. **Register business day (ADR-010):** All cache keys and period resolution use **`business_date`** from `utils/dailyOpsBusinessDate.ts` — never raw ISO calendar “today”. Daily cache key = snapshot `business_date` (register opens 08:00 Amsterdam). “Today” / open register = `amsterdamOpenRegisterBusinessDateYmd()`. Partial periods (`this-month`, `this-year`, `this-week`) cap `endDate` to open register. Hourly buckets in daily detail use `calendarHourToBusinessDate` where wall-clock hour maps to register day. Week/month/year rollups sum **business_date** daily docs only (same dates as `daily_ops_snapshot_master.businessDate`).

**Consequences:**
- Staff totals/plusmin must get their own cache profiles (currently live Mongo — gap to implement).
- Remove startup full-history filesystem rebuild; bounded catchup or Mongo-only backfill.
- `aggregateDailyBundles` and cascade logic must strip detail on rollup (implement under ADR-013).
- `bundleDashboardSectionsIncomplete` rules adjust: period views may omit drilldown/PBI by design.

**Related:** ADR-004, ADR-006, ADR-008, ADR-010, ADR-011, ADR-020, ADR-022  
**Docs:** `dev-docs/CACHE_CASCADE.md`, `ARCHITECTURE.md` §2–3

---

## ADR-014 — Single net-profit formula (SSOT) for all Daily Ops surfaces

**Status:** Accepted (2026-07-14)

**Context:** Dashboard summary KPIs, period-breakdown chart bars (day/week/month/year), and cached rollups used `profit = revenue − labor` while hourly drilldown and profit-by-interval used the full estimated P&L (`revenue − labor − COGS − fixed overhead`). Yearly monthly bars therefore showed much higher “profit” than daily hourly views for the same business.

**Decision:**

1. **Formula SSOT:** `pnlFromRevenueLabor()` in `server/utils/dailyOpsInsights/pnlFromRevenueLabor.ts`.  
   `net_profit = revenue − loadedLabor − COGS − fixed_overhead`  
   - COGS: period food share × food COGS% + beverage share × bev COGS% (50/50 when category mix unknown).  
   - Fixed overhead: revenue × overhead%.  
   - Convenience wrapper: `netProfitFromHeadline(revenue, labor, categoryTotals, assumptions)`.

2. **Assumptions SSOT (dashboard):** Mongo app setting via `loadPnlAssumptions()` (`server/utils/appSettings/pnlAssumptionsSetting.ts`), defaults in `utils/dailyOpsPnlAssumptionsDefaults.ts`. User-adjustable via app settings API. Insights page may additionally resolve accounting benchmarks (`utils/accountingPnlAssumptions.ts`) — same formula, different assumption source.

3. **Category mix:** Sum `revenue.revenueByCategory` food/drinks from daily bundles when rolling up; unknown mix → 50/50 food/bev COGS split.

4. **All profit outputs must call the SSOT** — no inline `revenue − labor` for headline profit, summary KPIs, or period-breakdown bars. Hourly drilldown and profit-by-interval delegate to the same function.

5. **Cache invalidation:** Bump `DAILY_OPS_BUNDLE_CACHE_VERSION` when profit math changes; rebuild read-cache rollups.

**Amendment (2026-08-05) — live assumptions vs sealed Finance:**

6. **Sealed month:** Prefer percentages and net from sealed `accounting_pnl_benchmark` (Finance). Do not invent a second “estimated” net that disagrees with Finance `result` for sealed months (ADR-022).
7. **Open / partial periods:** Use rolling sealed-window assumptions (`loadPnlAssumptions` / `refreshFinanceAssumptions`) on ops revenue + **employer-loaded** labor (ADR-020). After each Finance seal, refresh assumptions and rewrite affected cache cascade (ADR-013).
8. **Labor input to the formula:** `loadedLabor` must be employer cost (ADR-020), not raw Eitje wage. Insights-only multipliers are not SSOT.

**Apply map:**

| Surface | File |
|--------|------|
| Formula + helpers | `server/utils/dailyOpsInsights/pnlFromRevenueLabor.ts` |
| Summary KPI | `server/utils/dailyOpsMetrics/dtoBuilders.ts` → `buildDailyOpsSummaryDto` |
| Week/month/year rollups | `server/utils/dailyOpsSnapshot/aggregateDailyBundles.ts` |
| Period breakdown bars | `server/utils/dailyOpsSnapshot/buildPeriodBreakdown.ts` |
| Hourly drilldown | `server/utils/dailyOpsSnapshot/drilldown/buildRevenueDrilldownHourly.ts` |
| Profit-by-interval | `server/utils/dailyOpsSnapshot/buildProfitByIntervalFromSnapshot.ts` |
| Revenue P&L API | `server/utils/dailyOpsRevenue/computeSimplePnL.ts` |
| Assumptions (configurable) | `server/utils/appSettings/pnlAssumptionsSetting.ts` |

**Consequences:** Yearly/monthly profit bars align with daily hourly math. Rollup cache must be regenerated after deploy. `profitMarginPct` on summary reflects net margin (after COGS + overhead), not gross margin after labor only. Sealed months follow Finance; open months follow refreshed assumptions (ADR-020/022).

**Related:** ADR-004, ADR-013, ADR-019, ADR-020, ADR-022

---

## ADR-015 — Weekly Reports environment (sealed documents)

**Status:** Accepted (2026-07-14)

**Context:** The Daily Ops weekly digest (`daily_ops_read_cache` · `profile=weekly-digest`) is a read-only analytics view. Operations teams need an interactive weekly document with per-topic findings, todos, agreements, weather context, and calendar events — without changing the existing Daily Ops page or read-cache path.

**Decision:**

1. **New environment:** `weekly-reports` — fourth app environment alongside Daily Ops, Daily Notes, and Daily Menu. Routes under `/weekly-reports/*`.

2. **New collections (additive, hot tier):**
   - `weather_observations` — daily rows for Den Haag (all venues share city-level weather). Source: Open-Meteo. Written by `daily-ops:weather-sync` cron + one-time backfill.
   - `calendar_events` — national holidays, regio Midden school holidays, religious observances, major sports (e.g. Oranje WK 2026), and custom one-off events. Seeded via script; custom events via Weekly Reports UI. App-wide SSOT for sales-context events.
   - `weekly_reports` — one sealed document per `weekKey` + `locationId` (per venue only, no combined "all" doc). Contains denormalized `digest` (from `buildWeeklyDigest`), `weather`, `events`, and user `sections` (comments/todos/agrees per topic).

3. **Build path:** `buildWeeklyDigest` unchanged. New `buildWeeklyReportComputed` enriches digest with weather + events and writes to `weekly_reports`. Cron `daily-ops:weekly-report-build` runs Monday 01:15 Amsterdam for last 5 weeks × 3 venues.

4. **Freeze rule:** Computed fields (digest, weather, events) auto-refresh until **14 days after week end**, then `frozenAt` is set and computed fields stop updating. User sections (comments/todos/agreements) remain editable always.

5. **Daily Ops unchanged:** `pages/daily-ops/analytics/weekly-report.vue` keeps reading read-cache. Single "See full report" link to `/weekly-reports/[weekKey]`.

6. **PDF:** Browser print via `lib/pdf/weeklyReportPdfDocument.ts` (same pattern as notes PDF).

**Apply map:**

| Surface | File |
|--------|------|
| Weather fetch/upsert | `server/utils/dailyOpsWeather/*` |
| Calendar seed/query | `server/utils/dailyOpsCalendarEvents/*` |
| Document builder | `server/utils/weeklyReportDocument/*` |
| API | `server/api/weekly-reports/*` |
| UI | `pages/weekly-reports/*`, `components/weeklyReports/*` |
| Crons | `server/tasks/daily-ops/weather-sync.ts`, `weekly-report-build.ts` |

**Consequences:** Three new Mongo collections. Weather backfill required once (`pnpm weather:backfill`). Calendar seed once (`pnpm calendar:seed`). Daily Ops weekly digest remains ADR-013 read-cache SSOT; `weekly_reports` is a separate sealed document layer.

**Related:** ADR-004, ADR-013, ADR-014

---

## ADR-016 — Staff Org environment (scenario boards)

**Status:** Accepted (2026-07-22)

**Context:** Closing a venue (l'Amour) requires redistributing FT staff across remaining locations. Existing Excel roosters and Daily Ops labor snapshots are not suited for what-if organisation. We need a saveable board without coupling to snapshot/read-cache rebuilds.

**Decision:**

1. **New environment:** `staff-org` — fifth app environment. Routes under `/staff-org/*`.

2. **New collection (additive, hot app data):** `staff_org_scenarios` — one document per named organisation scenario (draft/active/archived). Holds `orgAssignments` (TeamBuilder: location × team × role), `placements` (RosterPlanner), `locationRules`, `locationTargets`, `inactiveMemberIds`, and denormalized `roster`.

3. **Read-only inputs:** `members` (FT/PT/ZZP + stage, wages) and hardcoded [`dailyOpsVenueOpeningHours`](utils/dailyOpsVenueOpeningHours.ts). No writes to snapshots, `daily_ops_read_cache`, Eitje/Bork aggregations, or crons.

4. **Two-step board:** (1) **TeamBuilder** organogram — scenario `venues` (open/closed; add future sites); Manager / Floor / FT / PT·ZZP × Keuken/Bediening/Bar; per-venue **budget** (monthly revenue, food→keuken / beverage→bediening+bar shares, contract labor €, labor % actual vs target, min/max rules); close venue → staff → Unassigned; closed venues listed under Not active locations. (2) **RosterPlanner** — Mon–Sun × day/evening for open venues only; productivity uses team revenue pot + FT hours only (Managers/Chefs always FT).

5. **P&L seed (read-only):** `GET /api/staff-org/labor-benchmarks` seeds from the **last 12 sealed monthly** accounting P&L docs (avg). Total labor % + food/bev shares use the full window. FT/PT/ZZP actual % come from Labor Lonen grandchildren when present: **FT** = salarisBediening+Keuken+Overhead; **PT** = inhuurFb; **ZZP** = inhuurAfwas+Stewarding+Keuken+Overhead (months without Lonen lines excluded from those three %). No writes to Daily Ops cache.

**Amendment (2026-07-27):** Replaced fixed calendar-year 2025 totals with rolling 12 sealed months + Lonen→FT/PT/ZZP map above.

6. **Daily Ops unchanged:** No changes to labor GET paths or ADR-013 cache cascade.

**Amendment (2026-07-28):** TeamBuilder roles split PT into **PT Sr** (`pt_sr`, fixed days/week intent) above **PT** (`pt`, flexible). Scenario roster may store planner `desiredWeeklyHours` (u/w available/wanted) for PT / PT Sr; survives roster sync via memberId merge. Not auto-classified from contract CSV yet — drag into lane + set hours in UI.

**Apply map:**

| Surface | File |
|--------|------|
| Types | `types/staff-org.ts`, `types/environment.ts` |
| Repo / metrics | `server/utils/staffOrg/*` |
| API | `server/api/staff-org/*` |
| UI | `pages/staff-org/*`, `components/staffOrg/*` |
| Env wiring | `composables/useEnvironment.ts`, `components/AppSidebar.vue` |

**Consequences:** One new Mongo collection. Scenarios are self-contained and reloadable. Not a live Eitje planner — organisation / organigram only.

**Related:** ADR-004, ADR-013, ADR-015

---

## ADR-018 — Bork V2 rebuild dedupes orders across raw sync dumps

**Status:** Accepted (2026-07-28)

**Context:** `rebuildBorkSalesAggregationV2` scanned every `bork_raw_data` (`bork_daily`) document and summed matching orders. Nightly/intraday syncs overlap — the same `Order.Key` appears in multiple dumps — so orderTime (and paid) totals were inflated (~€600 on VK 2026-07-27 vs a single dump / Basis netto).

**Decision:**

1. Collect orders into an in-memory map keyed by `locationId` + `Order.Key` (TicketNr/Date/Time/Table fallback).
2. When the same key appears in multiple `bork_raw_data` dumps, keep the copy from the **newest** dump (`date` / `fetchedAt`).
3. Aggregate V2 collections from that canonical set only (no double-count).

**Consequences:** V2 hour/day/order-hour rollups match unique orders. Re-run V2 rebuild + snapshot/cache refresh for days already sealed with inflated fat slices. Morning Basis remains sealed headline SSOT (ADR-004).

**Related:** ADR-004, ADR-006, ADR-010

---

## ADR-017 — Period breakdown Staff = Keuken+Bediening; occupancy on graph

**Status:** Accepted (2026-07-28)

**Context:** Venue-strip graph Staff counted all teams (incl. Management / Ziek / Verlof). Bezettingsgraad lived only as a separate section. Hour occupancy was a revenue-share proxy, not real active÷total.

**Decision:**

1. **Staff headcount** on `periodBreakdown` = distinct Keuken + Bediening only (`staffByTeam`). Stacked chart uses two orange shades; total on top. Afwas via strip 50/50 stays in keuken/bediening worker counts; hour path excludes non-keuken/bediening team names.
2. **Day occupancy** = active tables (snapshot `tables`) ÷ catalog `daily_ops_venue_tables` — sealed as `occupancyPct` / `tableOccupancy`.
3. **Hour occupancy (real):** snapshot `tablesByHour` from `bork_sales_by_table` (`business_hour`) → `tableOccupancy.hourly[]` + `series.hour` = active÷total per venue×calendar hour. No revenue-share proxy on write path.
4. Graph joins sealed `tableOccupancy` when row `occupancyPct` missing (pre-reseal caches).
5. Backfill tables section + dashboard-bundle from **2026-07-01** forward.

**Related:** ADR-004, ADR-013

---

## ADR-019 — Break-even splits labor into FT-fixed vs PT/ZZP-flex

**Status:** Accepted (2026-08-04) — **delivery path amended by ADR-022 (2026-08-05)**

**Context:** Break-even used `BE = (labor + fixed) / (1 − cogs%)`, treating **all** labor as a period-fixed cost. That overstated Van Kinsbergen break-even (~€177k) vs the accountant’s estimate (~€160–165k) and vs sealed months that still showed a positive result near that revenue. In hospitality, PT (uren) and ZZP scale with volume; only FT contract wages (plus sociale lasten / pensioen) behave as fixed.

**Decision (formula — still valid):**

1. **Formula:** `BE = (fixedLabor + fixed) / (1 − cogs% − flexLaborRate)` where:
   - **fixedLabor** = `salarisBediening + salarisKeuken + salarisOverhead + overigLonen` + `laborSocialeLasten` + `laborPensioen` + `laborOverig`
   - **flexLaborRate** = `(inhuurFb + inhuurAfwas + inhuurStewarding + inhuurKeuken + inhuurOverhead) / revenue`
   - **cogs%** and **fixed** (overige + afschrijving + financieel) unchanged
2. **Rolling window:** last 12 sealed monthly accounting P&L docs; **dollar-weighted** (sum euros across months, divide once) — same weighting as Staff Org labor benchmarks (ADR-016). Not equal-weighted monthly %.
3. **Actual month preferred** when sealed for closed prior months; else rolling 12m (unchanged `pickSlice`).
4. **Legacy rows** without Lonen grandchildren: all `labor` treated as fixed (flex = 0).
5. **Staff Org FT/PT/ZZP helpers stay separate** (ADR-016 does not include `overigLonen` / `laborOverig` in FT) — break-even owns its own line mapping in `utils/accountingPnlBreakEvenMath.ts`.
6. **Refresh:** saving Finance → P&L (or Recalculate) rebuilds `break_even_assumptions` via `refreshFinanceAssumptions`.

**Amendment (2026-08-05) — delivery & periods (see ADR-022):**

7. **Formula ADRs do not invent GET paths.** Original apply map (`resolveBreakEven` on every GET) **violated ADR-013 precedence**. Transitional only until BE/Est. net land in read-cache cascade.
8. **Verified:** Applying ADR-019 math to sealed Finance rows yields Est. net = Finance `result` (exact). Wrong UI year/YTD numbers were **period composition bugs**, not formula bugs — governed by ADR-022.
9. **Related must include ADR-013** for any Daily Ops KPI surface.

**Apply map (formula):**

| Surface | File |
|--------|------|
| Pure math | `utils/accountingPnlBreakEvenMath.ts` |
| Types | `types/break-even.ts` |
| Assumptions build / store | `server/utils/accountingPnl/buildBreakEvenAssumptions.ts`, `breakEvenAssumptionsSetting.ts` |
| Resolve + GET | **Transitional** — target: cache writer + GET read-cache (ADR-022) |
| UI source label | `components/daily-ops/DailyOpsKpiTiles.vue` |

**Consequences:** After deploy, run Finance P&L **Recalculate**. UI shows `actual_month` vs `rolling_12m`. Implement ADR-022 before treating BE GET as production-complete.

**Related:** ADR-004, ADR-013, ADR-014, ADR-016, ADR-020, ADR-022

---

## ADR-020 — Ops labor cost must reconcile to Finance employer labor

**Status:** Accepted (2026-08-05)

**Context:** Daily Ops stores `wage_cost` (hourly × hours) and `loaded_cost` (employer). Owner-true labor in Finance P&L includes lonen + sociale lasten + pensioen + overig. Agents repeatedly treated wage−vs−Finance gaps as “expected” and left employer load half-wired: nul-uren ×1.56 only; FT depended on imported `cost_per_hour`; `CALIBRATED_LABOR_MULTIPLIER` lived in Insights only (2025 table) and never became snapshot/cache SSOT. 2026 YTD check: ops `loaded_cost` ≈ **−8.6%** vs Finance labor — fail band.

**Decision:**

1. **SSOT for dashboard labor €:** Snapshot / read-cache `loaded_cost` = **employer cost the owner pays**, not raw wage.
2. **FT and flex both load** to employer cost. Nul-uren ×1.56 is a fallback, not the full story. ZZP stays hourly (invoice) unless Finance proves otherwise.
3. **Calibration source:** Sealed Finance months (`labor`, `laborLonen`, sociale, pensioen, overig, Lonen lines). Target: after seal, ops monthly `loaded_cost` vs Finance labor within **≤2%** preferred, **≤5%** hard fail → ops notification (ADR-021).
4. **Where the ratio lives:** Aggregation → `eitje_time_registration_aggregation.total_cost_loaded` → `buildLaborSection` → snapshot → **ADR-013 cache**. Insights-only `scaleEitjeLoadedLabor` is **not** SSOT; either delete or make it call the same SSOT helper.
5. **Open months:** Use last sealed rolling ratio / `cost_per_hour` from members until next Finance seal; then recalibrate and rewrite history in band (forecast loop later).
6. **ADR-014 / BE inputs** must consume this employer-loaded labor, not wage.

**Consequences:** Rebuild labor aggregation + snapshots after load-path fix. Update `ARCHITECTURE.md` business rule beyond “nul-uren ×1.56 only.” Members `cost_per_hour` (ADR-001) remains FT storage; missing/wrong cph is an integrity alert, not silent wage display.

**Related:** ADR-001, ADR-004, ADR-009, ADR-013, ADR-014, ADR-019, ADR-021, ADR-022

---

## ADR-021 — Cross-source verify + self-heal is mandatory

**Status:** Accepted (2026-08-05)

**Context:** Live APIs (Bork, Eitje), Gmail inbox, and sealed Finance P&L can disagree. Partial syncs and silent drift produced wrong KPIs. Pieces already exist (ops notifications, Bork↔Inbox detectors, ADR-004 auto-retry) but were never a first-class constitution — so agents skipped “check against Finance / inbox” and blamed UI.

**Decision:**

1. **UI is never SSOT.** It only renders write-path / cache output. Wrong number ⇒ fix compute or data, not the Vue layer.
2. **Required cross-checks** (extend `server/utils/opsNotifications/`):
   - Bork API ↔ Basis inbox (existing discrepancy bands).
   - Eitje API hours ↔ inbox hours / contracts where applicable (ADR-009).
   - Ops snapshot monthly **revenue** and **loaded labor** ↔ sealed Finance P&L (bands: rev ≤5%, labor ≤5% hard; prefer ≤2%) — ADR-020.
3. **Self-heal:** Prefer safe auto-retry / snapshot rebuild / cache cascade refresh (ADR-004 amendments). When auto-fix is unsafe → persistent ops alert until human + rebuild.
4. **Silent drift is a bug.** Never document a known Finance gap as “expected” without an ADR-020 calibration ticket and an alert.
5. **Verification before claiming “correct”:** Month-level compare against sealed Finance (or inbox) for the metric under change — same discipline as 2026 Jan–Jun BE audit.

**Consequences:** New detectors for Finance vs ops. Agents must plan verify steps when changing revenue/labor/BE. Complements ADR-004 auto-retry; does not replace ADR-013 read-cache rule.

**Related:** ADR-004, ADR-009, ADR-013, ADR-014, ADR-020, ADR-022

---

## ADR-022 — BE / Est. net period composition + Finance seal truth (fixes ADR-019 delivery)

**Status:** Accepted (2026-08-05)  
**Amends:** ADR-019 delivery path · **Extends:** ADR-013 (BE/Est. net as cache fields) · **Aligns:** ADR-014 sealed vs open assumptions

**Context:** ADR-019 formula is correct on Finance rows (Est. net = Finance `result` exactly). Production UI still showed absurd YTD Est. net because GET math treated **this-year like one month of BE vs YTD revenue**, and/or mixed ops assumptions with sealed months. That is a **period composition** failure and an **ADR-013 violation** (invent-on-GET), not a Vue bug.

**Decision:**

1. **Sealed calendar month:**  
   - **Est. net** = Finance `result` (SSOT).  
   - **BE** = ADR-019 math on that month’s Finance row.  
   - Do not re-estimate sealed months from rolling assumptions.

2. **Multi-month / YTD / year:**  
   - Compose from **month slices** (sum Est. net = sum of month `result`; BE display = dollar-weighted or per-month then explain — never one monthly BE vs full-year revenue).  
   - Day ↔ week ↔ month ↔ year must **add both ways** within rounding.

3. **Open month / today / this-week (partial):**  
   - Use rolling assumptions (ADR-019 refresh) on ops headline revenue + employer-loaded labor (ADR-020).  
   - Label source (`rolling_12m` vs `actual_month`) in UI.

4. **Delivery (ADR-013):**  
   - Write BE + Est. net into read-cache cascade (dashboard-bundle and/or dedicated profile) on snapshot seal and on Finance save/recalculate.  
   - GET reads cache only. `resolveBreakEven` live path is **transitional** until cascade ships; must still obey rules 1–3.

5. **Finance seal event:** Refresh assumptions → rewrite open-month forecasts in band → cascade week/month/year cache (feeds future calibration loop).

6. **Precedence:** If this ADR conflicts with a clever GET shortcut, **013 + this ADR win**.

**Consequences:** Implement cache fields + fix year/week rollup before declaring BE “done.” Update `@adr-ref` on BE files to include ADR-013, ADR-022. Verify each sealed 2026 month: Est. net matches Finance; YTD = sum of months.

**Implementation gaps fixed (2026-08-05):**

1. **Open-month drop:** Multi-month Est. net previously skipped unsealed spans (`if (!doc) continue`), so `this-year` showed only Jan–Jun Finance while revenue included Jul/Aug. Now open spans use CM estimate; mixed periods label `source: blended`.
2. **Rolling FT/flex dilution:** Averaging `laborLonenLines` across 12 months (÷n) with legacy months lacking lonen lines halved fixed/flex %. Rolling now resolves FT/flex **per row** then dollar-weights (`resolveFixedFlexTotalsForRows`).
3. **Ops revenue for open Est. net:** CM estimate must use **ops/inbox headline revenue** (ADR-022 §3), not rolling `monthlyRevenue`. `accountingResult` = sealed Finance only; `estimatedNet` = sealed + open CM on ops revenue. UI labels “Finance P&L” only when `source === actual_month`.
4. **ADR-020 labor load:** Snapshot `buildLaborSection` scales `loaded_cost` by Finance÷ops sealed ratios (2026 venue table in `accountingPnlLaborMultiplier`). Rebuild labor snapshots required after deploy.

**Related:** ADR-004, ADR-013, ADR-014, ADR-019, ADR-020, ADR-021

---

