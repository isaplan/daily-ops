# Daily Ops Dashboard Snapshots — Implementation Plan

**Branch:** `feat/daily-ops-snapshots`
**Status:** proposed
**Owner:** TBD
**Last updated:** 2026-05-13

---

## 1. Why this exists

Every load of `/daily-ops` runs ~9 collection queries plus multi-stage `$lookup` pipelines through `server/utils/dailyOpsDashboardMetrics.ts` and `server/api/daily-ops/metrics/bundle.get.ts`. The numbers are derived **per request** from Bork V2 aggregates, Eitje labor aggregates, and inbox basis report rows.

A V3 snapshot design exists in the repo (`types/daily-ops-v3.ts`, `dev-docs/V3-AGGREGATION-BUILD-PLAN.md`, `scripts/create-daily-ops-aggregated.ts`) but the writer service was **never ported from the Next.js app to Nuxt**. That script imports `@/lib/services/aggregation/dailyOpsAggregationService` and `@/lib/mongodb/v2-connection`, neither of which exist here.

This plan finishes the work: a **master snapshot document** per `(locationId, businessDate)` plus **section documents** keyed the same way. The home dashboard reads the master document only — one round trip, no joins.

## 2. Goals & non-goals

**Goals**

- Dashboard loads serve numbers from snapshot documents only — no raw scans, no live `$lookup`s.
- Snapshot service is **append/upsert only** on top of existing aggregated collections.
- All names (`locationName`, `teamName`, `userName`, `contractType`) are **denormalized** into snapshot documents.
- All revenue numbers expose **both** `ex_vat` and `inc_vat` plus `vat`. Snapshot never divides by a hard-coded factor.
- Snapshot keys to **business day 08:00 → 07:59:59 Amsterdam**.
- Rebuilds are **event-driven** off existing sync hooks (Bork V2, Eitje aggregation, inbox basis report).
- DTO contract for `bundle.get.ts` unchanged → no UI rewrite required.
- `status: 'partial' | 'final'` flag, sealed when the inbox 08:05 (`cron_hour=8`) yesterday-basis report lands.

**Non-goals**

- Replacing Bork or Eitje rebuild services.
- Changing inbox cron schedule.
- Adding new UI pages.
- Product combination analysis on raw transactions (deferred until a pre-aggregated combo collection exists).

## 3. Locked decisions

| # | Decision |
|---|----------|
| 1 | Master + section documents from day one. Not a single fat doc. |
| 2 | All Bork revenue surfaces carry **both** ex VAT and inc VAT (+ `total_vat`). Snapshot reads, does not compute. (See Phase 0.) |
| 3 | Denormalize names everywhere. No `$lookup` on dashboard read. |
| 4 | Business day = **08:00 Amsterdam → 07:59:59 next ISO day**. Already true in `borkRebuildAggregationV2Service.ts:50`. |
| 5 | **Eitje `period` (ISO date of shift start) = business_date directly.** No mapping. Assumption: no shifts start 00:00–07:59 Amsterdam. Documented in snapshot service header. |
| 6 | **Intraday inbox basis reports** (`cron_hour` 15/18/23 — semantics per `server/tasks/inbox/gmail-sync.ts`) act as **validators** stored alongside Bork API totals with a delta field. |
| 7 | **Morning inbox basis report** at **08:05** (`cron_hour=8`) seals yesterday: `status: 'partial' → 'final'`, drives final labor productivity / revenue per hour. |
| 8 | Snapshot writer **never** reads raw collections. Aggregated only. |
| 9 | Provenance fields per source: `lastSyncAt`, `docCount`, `cronHour`, plus master-level `lastBuiltAt` + `builtBy`. |
| 10 | All IDs resolved to **unified collections** (`unified_location`, `unified_user`, `unified_team`, `members`). Bork V2 and Eitje agg already do this at the substrate level — snapshot inherits. |
| 11 | No verbose logging. Structured errors only. |
| 12 | Event-driven rebuilds with coalesced job queue; nightly cron only as safety net. |

## 4. Phase 0 — VAT prerequisite (must ship before snapshots can)

Today `borkRebuildAggregationV2Service.ts` line 6 carries this TODO:

> `[2026-05-08] TODO: Add total_revenue_ex_vat AND total_revenue_incl_vat fields (currently only has total_revenue which is incl VAT; raw line data has VAT breakdown)`

The snapshot guarantee in §3.2 cannot be honoured until that TODO is closed.

**Scope of Phase 0**

Add `total_revenue_ex_vat`, `total_revenue_inc_vat`, `total_vat` (computed from raw line VAT breakdown — never from a fixed divisor) to:

- `bork_business_days`
- `bork_sales_by_hour`
- `bork_sales_by_product`
- `bork_sales_by_table`
- `bork_sales_by_worker`
- `bork_sales_by_guest_account`
- `bork_sales_by_paymode`

Plus a **backfill run** across the existing range.

**Side cleanup while we're in the file:** fix stale `06:00` references — they're wrong; the code already keys to `08:00`. Affected:
- `server/utils/dailyOpsDashboardMetrics.ts` header lines 7–9
- `dev-docs/V3-AGGREGATION-BUILD-PLAN.md`

## 5. Collection layout

Naming convention: `daily_ops_snapshot` for the master, `daily_ops_snapshot_section_<name>` for sections.

### 5.1 Master — `daily_ops_snapshot`

One document per `(locationId, businessDate)`, plus optional combined key for "all locations". Target size: well under 30 KB.

**Unique index:** `{ businessDate: 1, locationId: 1 }`
**Secondary index:** `{ lastBuiltAt: 1 }`

**Document shape (logical, names final at TypeScript time):**

```
Identity
  _id                       // optional deterministic: `${locationId}_${businessDate}`
  schemaVersion             // 1
  businessDate              // "YYYY-MM-DD" (08:00 Amsterdam business day)
  businessDayStartUtc       // exact UTC instant of business day start
  businessDayEndUtc         // exact UTC instant of business day end (07:59:59.999)
  locationId                // ObjectId — unified_location._id (or "ALL")
  locationName              // denormalized from unified_location.primaryName

Status
  status                    // 'partial' | 'final'
  lastBuiltAt               // Date
  builtBy                   // event key, e.g. "eitje-sync:daily-data" | "bork-v2:rebuild" | "inbox:cron_hour=8" | "cron:nightly"

KPI cards (the home dashboard cards read this block)
  revenue
    ex_vat                  // number
    inc_vat                 // number
    vat                     // number
    leadSource              // 'inbox_basis_ex_vat' | 'bork_api_merged'  (decided per §6)
  labor
    totalLaborCostWages           // Σ hours × hourly_rate
    totalLaborCostLoaded          // Σ hours × cost_per_hour (fallback hourly_rate × 1.36 — same rule as eitje-staff page)
    totalLaborHours
    distinctWorkerCount
    revenuePerLaborHour           // ex_vat / hours
    laborCostPctOfRevenueWages    // wages / ex_vat × 100
    laborCostPctOfRevenueLoaded   // loaded / ex_vat × 100

Small denormalized rollups
  teams[]                   // { teamId, teamName, hours, costWages, costLoaded, workers, pctHours }
  contracts[]               // { contractType, hours, costWages, costLoaded, workers }
  revenueByCategory         // { drinks_ex_vat, drinks_inc_vat, food_ex_vat, food_inc_vat, ... }
  revenueByTimePeriod       // { heleDag, lunch, preDrinks, dinner, afterDrinks } — ex_vat numbers

Provenance
  sources
    bork                    // { suffix, businessDayDocCount, salesByHourDocCount, lastSyncAt }
    eitje                   // { aggDocCount, lastSyncAt }
    inbox                   // { basisReports: [{ cronHour, finalRevenueExVat, finalRevenueIncVat, deltaVsBork }] }

Section presence map
  sections
    revenue: boolean
    labor: boolean
    products: boolean
    tables: boolean
    workers: boolean
```

### 5.2 Section collections

All section docs share the same `{ businessDate, locationId }` compound unique index.

| Collection | Purpose | Phase |
|------------|---------|-------|
| `daily_ops_snapshot_section_revenue` | 24-hour revenue array (always 24 slots, zeros pre-filled), per-hour ex/inc/vat, time-period buckets, intraday inbox basis snapshots with delta, final basis snapshot, lead-source decision audit | A |
| `daily_ops_snapshot_section_labor` | per-team-day rows, per-contract-day rows, per-location-day rows, per-worker-day rows (denormalized names) | A |
| `daily_ops_snapshot_section_products` | top N products, qty, ex/inc/vat | B |
| `daily_ops_snapshot_section_tables` | per table / per waiter / per payment method | B |
| `daily_ops_snapshot_section_workers` | per-worker drawer rows: name, team, contract, hours, costWages, costLoaded, pct of team | B |

All numeric fields that come from Bork are **ex_vat + inc_vat + vat**. All numeric fields that come from Eitje are **labor cost in EUR** (both wages and loaded variants).

## 6. Lead source logic (single point of decision)

The snapshot writer decides which revenue value drives the headline, once per `(locationId, businessDate)`:

- **`status: 'final'`** → use the **08:05 (`cron_hour=8`) inbox basis** ex_vat as canonical. Stored as `revenue.leadSource = 'inbox_basis_ex_vat'`. Bork API totals retained in section for audit.
- **`status: 'partial'`** → use **Bork V2 aggregates** as canonical (`leadSource = 'bork_api_merged'`). Intraday inbox rows (cron 15/18/23) stored in section as validators with computed `deltaVsBork`.

The dashboard never re-decides. It reads `master.revenue.leadSource` and trusts the number.

## 7. Builder service

**New module:** `server/services/dailyOpsSnapshotService.ts`
**Helpers:** `server/utils/dailyOpsSnapshot/*.ts` — one file per concern (`buildRevenueSection.ts`, `buildLaborSection.ts`, `buildCards.ts`, `resolveSources.ts`, `denormalizeNames.ts`). Keeps the service file small per workspace rules.

**Public API**

```
buildDailyOpsSnapshot({ businessDate, locationId? })
buildDailyOpsSnapshotRange({ startDate, endDate, locationId? })
sealDailyOpsSnapshot({ businessDate, locationId })   // called when 08:05 inbox row lands
```

**Internal contract**

1. **No raw reads.** Aggregated collections only.
2. **Idempotent.** Same inputs → same outputs (modulo `lastBuiltAt`).
3. **`bulkWrite` per collection.** Section failures mark master `status: 'partial'` with an `errors[]` field; never block other sections.
4. **Job dedup key:** `${businessDate}|${locationId ?? 'ALL'}`. Light in-process coalescing (5–10 s window) or `daily_ops_snapshot_jobs` collection if cross-process needed.
5. **Service header documents the 00:00–07:59 shift-start assumption** for Eitje (§3.5).

## 8. Event-driven triggers

| Trigger | Hook site | Snapshot action |
|---------|-----------|-----------------|
| Eitje time-registration agg rebuild finishes | `server/services/eitjeSyncService.ts` (after lines ~560, ~595, ~825) | Enqueue `buildDailyOpsSnapshotRange` for affected dates × all venues. |
| Bork V2 rebuild finishes | `rebuildBorkSalesAggregationV2` call sites (`rg rebuildBorkSalesAggregationV2 server`) | Same. |
| Intraday inbox basis row upsert (cron 15/18/23) | `server/services/inboxProcessService.ts` after `inbox-bork-basis-report.updateOne` (line ~106); `server/services/basisReportBackfillService.ts` line ~125 | Rebuild that day's snapshot. Stored as validator. |
| **08:05 morning inbox row** (`cron_hour=8`) for yesterday | Same upsert site, branch on `cron_hour === 8` | Call `sealDailyOpsSnapshot` → status flips `partial → final`, lead source flips to inbox. |

**Safety net:** nightly cron `daily-ops-snapshots:rebuild-recent` rebuilds the last 14 business days. Catches any missed event.

## 9. API migration path

| Phase | Behavior | Risk |
|-------|----------|------|
| **0 — VAT prerequisite** | Extend Bork V2 service to emit `*_ex_vat` / `*_inc_vat` / `*_vat`. Backfill. No UI change. | Medium (touches widely read collections; staged behind suffix) |
| **A.1 — Plumbing** | Create snapshot collections, indexes, writer service. Master + revenue + labor sections only. No reads switch yet. | None |
| **A.2 — Shadow read** | Add `?source=snapshot` flag on `bundle.get.ts`. Internal diff endpoint compares snapshot vs current util for fixed fixtures. | None |
| **A.3 — Snapshot first** | `bundle.get.ts` prefers snapshot when present + fresh enough. Falls back to current util otherwise. | Low — fallback intact |
| **B — Section expansion** | Add products / tables / workers sections. UI pages that need them switch to snapshot read. | Low |
| **C — Deprecate** | Trim `dailyOpsDashboardMetrics.ts` to a thin fallback. Remove broken `scripts/create-daily-ops-aggregated.ts`. | Medium — only after coverage verified |

**Today freshness:** master holds `lastBuiltAt`. For `period=today`, dashboard reads partial snapshot. If `lastBuiltAt` older than a configurable threshold (default 15 min), trigger a background rebuild on read and serve the stale value once. No UI badge needed initially.

## 10. Backfill

**Script:** `scripts/backfill-daily-ops-snapshots.ts`

```
npx tsx scripts/backfill-daily-ops-snapshots.ts \
  --from 2026-01-01 --to 2026-05-13 \
  [--location 69d6cfa63d2adf93b79d1ae7] \
  [--include-all-combined]
```

**Order after Phase 0 ships:**
1. Rebuild Bork V2 aggregates with new VAT fields.
2. Run snapshot backfill across history.
3. Flip `bundle.get.ts` to snapshot-first.

## 11. Testing

- **Unit:** lead-source decision, loaded-cost fallback (`hourly_rate × 1.36` when `cost_per_hour` missing), 24-slot hour array pre-fill, denormalize-name resolvers.
- **Golden:** three fixed `(businessDate, locationId)` pairs. Compare `bundle` JSON between snapshot path and legacy util path. Diff must be empty (modulo formatting).
- **Contract:** `DailyOpsSummaryDto`, `DailyOpsLaborMetricsDto`, `DailyOpsRevenueBreakdownDto` shapes unchanged.
- **Smoke:** snapshot builder runs end-to-end on a seeded venue without touching raw collections (assert via collection counter spy).

## 12. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Phase 0 VAT split changes wide-blast-radius collections | Use a temporary `bork_*_v2_vat` suffix during rebuild, swap pointer when validated. |
| Snapshot drift vs legacy util | Diff endpoint + golden tests gate the Phase A.3 flip. |
| Missed sync event → stale partial | Coalesced job queue + nightly reconcile. |
| Master document growth | Section split already mandated; cap denormalized arrays (top-N products etc.) at section level. |
| Future shifts starting 00:00–07:59 (Eitje assumption breaks) | Documented assumption in service header; add Bork-style mapper at that point if it becomes real. |
| Two cost definitions confuse users | Card explicitly labels "Wages" vs "Loaded"; both stored in snapshot with distinct field names. |

## 13. Phased delivery

| Phase | Deliverable |
|-------|-------------|
| **0** | Bork V2 ex_vat / inc_vat / vat fields + backfill. Stale 06:00 comment cleanup. |
| **A.1** | Snapshot service + 3 collections: master, `_section_revenue`, `_section_labor`. Event hooks wired. |
| **A.2** | Shadow `?source=snapshot` + diff endpoint + golden fixtures. |
| **A.3** | `bundle.get.ts` snapshot-first read with legacy fallback. |
| **B** | `_section_products`, `_section_tables`, `_section_workers`. Page-level reads switch. |
| **C** | Deprecate heavy `dailyOpsDashboardMetrics.ts` paths. Delete broken `scripts/create-daily-ops-aggregated.ts`. Update `function-registry.json`. |

## 14. Files likely touched

**New**

- `server/services/dailyOpsSnapshotService.ts`
- `server/utils/dailyOpsSnapshot/*.ts` (per-section builders)
- `types/daily-ops-snapshot.ts`
- `scripts/backfill-daily-ops-snapshots.ts`

**Modified**

- `server/services/borkRebuildAggregationV2Service.ts` — Phase 0 VAT split.
- `server/services/eitjeSyncService.ts` — enqueue snapshot rebuild after agg.
- Bork V2 sync entry points — enqueue snapshot rebuild after rebuild.
- `server/services/inboxProcessService.ts`, `server/services/basisReportBackfillService.ts` — enqueue after basis upsert; call `sealDailyOpsSnapshot` on `cron_hour=8`.
- `server/api/daily-ops/metrics/bundle.get.ts` — snapshot-first read with fallback.
- `server/utils/dailyOpsDashboardMetrics.ts` — fix stale 06:00 header (Phase 0); trim heavy paths (Phase C).
- `dev-docs/V3-AGGREGATION-BUILD-PLAN.md` — fix stale 06:00 references (Phase 0).
- `function-registry.json` — register new modules per workspace rules.

**Removed (eventually)**

- `scripts/create-daily-ops-aggregated.ts` (broken Next.js imports).
- Legacy code paths in `dailyOpsDashboardMetrics.ts` once snapshot coverage is 100 %.

## 15. Open questions

None blocking. Phase 0 ordering and snapshot collection naming can be finalised at implementation time.

