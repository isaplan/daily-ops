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
